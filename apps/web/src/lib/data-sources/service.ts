import "server-only";

import { logger } from "@/lib/observability/logger";
import { parseLocation } from "@/lib/jobs/locations";
import { getConfiguredJobSources, getConfiguredSignalSources } from "./registry";
import { rankSignals, type RelevanceProfile, type ScoredSignal } from "./relevance";
import type { JobPosting, SignalQuery } from "./types";

/** Explicit location filter from the UI switcher; overrides the profile's region. */
export interface LocationFilter {
  country?: string; // ISO-3166 alpha-2, lowercase
  city?: string;
}

/**
 * Market-intelligence service — the seam between raw external sources and the
 * Kai Throne. It fans out to every configured source in parallel, normalizes,
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
  const parsed = parseLocation(profile.region);
  const country = location?.country ?? parsed.country;
  const city = location?.city ?? parsed.city;

  return {
    keywords: keywords.slice(0, 5),
    regions: profile.region ? [profile.region] : undefined,
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
const MARKET_TTL_MS = 15 * 60 * 1000;
const marketCache = new Map<string, { at: number; intel: MarketIntelligence }>();

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

/** Personalized market intelligence for Kai's context + the dashboard brief. */
export async function getMarketIntelligence(
  profile: RelevanceProfile,
  opts: { threshold?: number; limit?: number } = {},
): Promise<MarketIntelligence> {
  const cacheKey = marketCacheKey(profile, opts);
  const cached = marketCache.get(cacheKey);
  if (cached && Date.now() - cached.at < MARKET_TTL_MS) return cached.intel;

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
  marketCache.set(cacheKey, { at: Date.now(), intel });
  return intel;
}

/** Live job discovery across configured job sources, deduped by title+company. */
// Sources whose catalog is overwhelmingly tech/startup roles. For a non-tech
// user (finance, healthcare, trades…) these are mostly noise, so we drop them
// and lean on the cross-sector aggregators (Reed/Jooble/Adzuna).
const TECH_FOCUSED_SOURCES = new Set(["remotive", "arbeitnow", "hackernews"]);

function isLikelyTechDomain(domain?: string | null): boolean {
  if (!domain) return true; // unknown domain → keep every source (back-compat)
  return /tech|\bit\b|information technology|software|develop|engineer|data|cyber|security|cloud|devops|\bweb\b|\bai\b|\bml\b|computer|programming|sre|network/.test(
    domain.toLowerCase(),
  );
}

export async function discoverJobs(
  profile: RelevanceProfile,
  limit = 20,
  location?: LocationFilter,
): Promise<JobPosting[]> {
  let sources = getConfiguredJobSources();
  // Domain-aware: a finance user shouldn't be fed a tech-only board. Only filter
  // when at least one general source survives — never leave the user with zero.
  if (!isLikelyTechDomain(profile.domain)) {
    const general = sources.filter((s) => !TECH_FOCUSED_SOURCES.has(s.id));
    if (general.length > 0) sources = general;
  }
  const query = queryFromProfile(profile, limit, location);

  const settled = await Promise.allSettled(sources.map((s) => s.fetchJobs(query)));
  const perSource = settled.map((r) => (r.status === "fulfilled" ? r.value : []));

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
 * Compact, honest summary for injection into Kai's system context. Empty string
 * when nothing relevant is live — Kai then simply doesn't claim to have market news.
 */
export function summarizeForKai(intel: MarketIntelligence): string {
  if (intel.signals.length === 0) return "";

  const lines = intel.signals.map(
    (s) => `- ${s.title}${s.url ? ` (${s.url})` : ""} — ${s.reasons[0] ?? "relevant to your profile"}`,
  );

  return [
    "Live market signals relevant to this user (use for honest context, never to alarm):",
    ...lines,
  ].join("\n");
}
