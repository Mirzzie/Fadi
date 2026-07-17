import "server-only";

import { BoundedTtlCache } from "@/lib/cache/bounded";
import { logger } from "@/lib/observability/logger";
import { parseLocation } from "@/lib/jobs/locations";
import {
  decideJobCoverage,
  isLikelyTechDomain,
  type JobSourceCoverage,
  type SourceCoverage,
} from "./coverage";
import { getConfiguredJobSources, getConfiguredSignalSources, listSourceStatus } from "./registry";
import { rankSignals, type RelevanceProfile, type ScoredSignal } from "./relevance";
import type { JobPosting, JobSource, SignalQuery } from "./types";

/** Last real per-source pull — in-memory (per process), reset on deploy. */
type JobSourceRun = {
  at: number;
  query: string;
  sources: Array<{ id: string; status: "ok" | "error"; count: number }>;
};
let _lastJobSourceRun: JobSourceRun | null = null;

export type JobSourceHealth = {
  id: string;
  name: string;
  configured: boolean;
  /** Last pull's outcome for this source, when we've run one this process. */
  lastRun: { status: "ok" | "error"; count: number } | null;
};

/**
 * Honest source health for the Jobs UI: every job-listing source, whether it's
 * configured (key present), and what it returned on the last real pull — so a user
 * can SEE which APIs are working vs merely wired, and spot a silently-failing one.
 */
export function getJobSourcesHealth(): { sources: JobSourceHealth[]; lastRunAt: number | null } {
  const run = new Map((_lastJobSourceRun?.sources ?? []).map((s) => [s.id, s]));
  const sources = listSourceStatus()
    .filter((s) => s.capabilities.includes("job_listings"))
    .map((s) => {
      const r = run.get(s.id);
      return {
        id: s.id,
        name: s.name,
        configured: s.configured,
        lastRun: r ? { status: r.status, count: r.count } : null,
      };
    });
  return { sources, lastRunAt: _lastJobSourceRun?.at ?? null };
}

/** Explicit location filter from the UI switcher; overrides the profile's region. */
export interface LocationFilter {
  country?: string; // ISO-3166 alpha-2, lowercase
  city?: string;
  /** User explicitly chose "Any country" — search worldwide; do NOT fall back to
   *  the profile region (which is why a Dublin profile only ever saw Irish jobs). */
  worldwide?: boolean;
}

/**
 * Market-intelligence service — the seam between raw external sources and the
 * Fadi Throne. It fans out to every configured source in parallel, normalizes,
 * and scores everything against the user's profile, so what comes back is
 * already personalized: "the signals that matter to YOU", not a news dump.
 */

// Seniority/filler words that hurt search recall (HN/GDELT match poorly on them).
const KEYWORD_STOPWORDS = new Set([
  "the", "and", "of", "a", "to", "with", "in", "for", "or",
  "staff", "senior", "junior", "lead", "principal", "mid", "entry", "level",
  "fluency", "sense", "depth", "skills", "engineer", "developer",
]);

/**
 * Turn verbose role/skill phrases into a few searchable terms — full phrases
 * like "Staff Frontend Engineer" or "AI / LLM fluency" return little; tokens
 * like "frontend", "AI", "react" surface real signals.
 */
function queryFromProfile(
  profile: RelevanceProfile,
  limit = 15,
  location?: LocationFilter,
): SignalQuery {
  const phrases = [
    profile.targetRole,
    ...profile.skillGaps.slice(0, 3),
    ...profile.skills.slice(0, 3),
  ].filter(Boolean) as string[];

  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const word of phrases.flatMap((p) => p.split(/[^a-zA-Z0-9+#]+/))) {
    const term = word.trim();
    const key = term.toLowerCase();
    if (term.length >= 2 && !KEYWORD_STOPWORDS.has(key) && !seen.has(key)) {
      seen.add(key);
      keywords.push(term);
    }
  }

  // Explicit UI filter wins; otherwise derive country/city from the profile region.
  // "Any country" (worldwide) deliberately skips the profile fallback AND the region
  // pin, so sources return postings from anywhere instead of only the home market.
  const worldwide = location?.worldwide === true;
  const parsed = parseLocation(profile.region);
  const country = worldwide ? undefined : (location?.country ?? parsed.country);
  const city = worldwide ? undefined : (location?.city ?? parsed.city);

  return {
    keywords: keywords.slice(0, 5),
    regions: worldwide || !profile.region ? undefined : [profile.region],
    country,
    city,
    limit,
  };
}

export interface MarketIntelligence {
  /** Top personalized signals, already ranked + explained. */
  signals: ScoredSignal[];
  /** Which sources actually contributed (honest about what's live). */
  activeSources: string[];
  generatedAt: string;
}

// Cache personalized intelligence per profile-query so the chat path can carry
// live signals without paying the fetch latency on every message.
//
// BOUNDED on purpose (BoundedTtlCache). The key is per (role, region, skills, gaps,
// thresholds) — high-cardinality across users — and the previous raw Map only checked
// its TTL on READ, so stale entries were never removed and it grew without limit for
// the life of the process: a slow memory leak on a long-running self-host node.
const MARKET_TTL_MS = 15 * 60 * 1000;
const MARKET_CACHE_MAX = 500;
const marketCache = new BoundedTtlCache<MarketIntelligence>(MARKET_TTL_MS, MARKET_CACHE_MAX);

function marketCacheKey(profile: RelevanceProfile, opts: { threshold?: number; limit?: number }) {
  return JSON.stringify([
    profile.targetRole,
    profile.region,
    profile.skills?.slice(0, 4),
    profile.skillGaps?.slice(0, 4),
    opts.threshold,
    opts.limit,
  ]);
}

/** Personalized market intelligence for Fadi's context + the dashboard brief. */
export async function getMarketIntelligence(
  profile: RelevanceProfile,
  opts: { threshold?: number; limit?: number } = {},
): Promise<MarketIntelligence> {
  const cacheKey = marketCacheKey(profile, opts);
  const cached = marketCache.get(cacheKey);
  if (cached) return cached;

  const sources = getConfiguredSignalSources();
  const query = queryFromProfile(profile);

  const settled = await Promise.allSettled(sources.map((s) => s.fetchSignals(query)));

  const signals = settled.flatMap((r, i) => {
    if (r.status === "fulfilled") return r.value;
    logger.warn("data_sources.signal_fetch_failed", { source: sources[i]?.id });
    return [];
  });

  const ranked = rankSignals(signals, profile, {
    threshold: opts.threshold ?? 35,
    limit: opts.limit ?? 5,
  });

  logger.info("data_sources.market_intelligence", {
    sources: sources.length,
    rawSignals: signals.length,
    surfaced: ranked.length,
  });

  const intel: MarketIntelligence = {
    signals: ranked,
    activeSources: sources.map((s) => s.id),
    generatedAt: new Date().toISOString(),
  };
  marketCache.set(cacheKey, intel);
  return intel;
}

/** A source's declared industry breadth (defaults to general/cross-industry). */
function sourceCoverage(s: JobSource): SourceCoverage {
  return s.coverage ?? "general";
}

/**
 * Honest coverage read for the Jobs UI: does the configured set actually serve
 * this user's field, and if not, what unlocks it? Domain-agnostic — never assumes
 * tech. See lib/data-sources/coverage.ts for the pure decision.
 */
export function getJobSourceCoverage(domain?: string | null): JobSourceCoverage {
  const sources = getConfiguredJobSources().map((s) => ({
    id: s.id,
    name: s.name,
    coverage: sourceCoverage(s),
  }));
  return decideJobCoverage(domain, sources);
}

/** Live job discovery across configured job sources, deduped by title+company. */
export async function discoverJobs(
  profile: RelevanceProfile,
  limit = 20,
  location?: LocationFilter,
): Promise<JobPosting[]> {
  let sources = getConfiguredJobSources();
  // Domain-aware: a finance/healthcare/trades user shouldn't be fed a tech-only
  // board. For a non-tech field we drop tech sources entirely — and if that leaves
  // nothing, we return an HONEST empty rather than tech noise (the UI shows a
  // coverage advisory from getJobSourceCoverage explaining the fix).
  if (!isLikelyTechDomain(profile.domain)) {
    sources = sources.filter((s) => sourceCoverage(s) !== "tech");
    if (sources.length === 0) {
      logger.info("data_sources.discover_jobs", {
        configured: "none_general",
        query: profile.targetRole ?? "",
        perSource: "skipped:non_tech_no_general_source",
      });
      return [];
    }
  }
  const query = queryFromProfile(profile, limit, location);

  const settled = await Promise.allSettled(sources.map((s) => s.fetchJobs(query)));
  const perSource = settled.map((r) => (r.status === "fulfilled" ? r.value : []));

  // Record what each source returned on this real pull, so the UI can show which
  // APIs are actually live (vs merely configured) and surface a silently-failing one.
  _lastJobSourceRun = {
    at: Date.now(),
    query: `${query.keywords.join("+")}|country=${query.country ?? "any"}|city=${query.city ?? ""}`,
    sources: settled.map((r, i) => ({
      id: sources[i]?.id ?? "?",
      status: r.status === "fulfilled" ? ("ok" as const) : ("error" as const),
      count: r.status === "fulfilled" ? r.value.length : 0,
    })),
  };

  // Round-robin across sources so EVERY source contributes to the limited set —
  // otherwise the first source (Remotive) fills the whole limit and location-
  // specific sources (Reed/Jooble for Ireland) get sliced off and never stored.
  const jobs: JobPosting[] = [];
  const maxLen = perSource.reduce((m, a) => Math.max(m, a.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const arr of perSource) {
      if (arr[i]) jobs.push(arr[i]);
    }
  }

  logger.info("data_sources.discover_jobs", {
    configured: sources.map((s) => s.id).join(",") || "none",
    query: `${query.keywords.join("+")}|country=${query.country ?? ""}|city=${query.city ?? ""}`,
    perSource: settled
      .map((r, i) => `${sources[i]?.id}:${r.status === "fulfilled" ? r.value.length : "ERR"}`)
      .join(","),
  });

  const seen = new Set<string>();
  return jobs
    .filter((j) => {
      const key = `${j.company.toLowerCase()}::${j.title.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

/**
 * Compact, honest summary for injection into Fadi's system context. Empty string
 * when nothing relevant is live — Fadi then simply doesn't claim to have market news.
 */
export function summarizeForFadi(intel: MarketIntelligence): string {
  if (intel.signals.length === 0) return "";

  const lines = intel.signals.map(
    (s) => `- ${s.title}${s.url ? ` (${s.url})` : ""} — ${s.reasons[0] ?? "relevant to your profile"}`,
  );

  return [
    "Live market signals relevant to this user (use for honest context, never to alarm):",
    ...lines,
  ].join("\n");
}
