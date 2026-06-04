import "server-only";

import { logger } from "@/lib/observability/logger";
import { getConfiguredJobSources, getConfiguredSignalSources } from "./registry";
import { rankSignals, type RelevanceProfile, type ScoredSignal } from "./relevance";
import type { JobPosting, SignalQuery } from "./types";

/**
 * Market-intelligence service — the seam between raw external sources and the
 * Kai Throne. It fans out to every configured source in parallel, normalizes,
 * and scores everything against the user's profile, so what comes back is
 * already personalized: "the signals that matter to YOU", not a news dump.
 */

function queryFromProfile(profile: RelevanceProfile, limit = 15): SignalQuery {
  // Search terms = role + a few skills/gaps; gaps first (most actionable).
  const keywords = [
    profile.targetRole,
    ...profile.skillGaps.slice(0, 2),
    ...profile.skills.slice(0, 2),
  ].filter(Boolean);

  return {
    keywords,
    regions: profile.region ? [profile.region] : undefined,
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
export async function discoverJobs(profile: RelevanceProfile, limit = 20): Promise<JobPosting[]> {
  const sources = getConfiguredJobSources();
  const query = queryFromProfile(profile, limit);

  const settled = await Promise.allSettled(sources.map((s) => s.fetchJobs(query)));
  const jobs = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

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
