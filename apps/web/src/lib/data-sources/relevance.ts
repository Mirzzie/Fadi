/**
 * Relevance scoring — pure logic. Turns a global firehose of signals into "the
 * three things that matter to YOU today" by scoring each signal against the
 * user's profile. Nothing reaches the user (or Kai's mouth) below threshold.
 */

import type { MarketSignal } from "./types";

export interface RelevanceProfile {
  targetRole: string;
  /** Skills the user has + skills they're targeting/missing — both matter. */
  skills: string[];
  /** Skill gaps get a boost: a rising trend in a gap is the most actionable signal. */
  skillGaps: string[];
  region?: string | null;
  sectors?: string[];
  /** The track's field/industry (e.g. "Finance"). Drives domain-aware source selection. */
  domain?: string | null;
}

export interface ScoredSignal extends MarketSignal {
  relevance: number; // 0–100
  /** Why it scored — for honest, explainable surfacing ("relevant because …"). */
  reasons: string[];
}

const WEIGHTS = {
  role: 30,
  skill: 25,
  skillGap: 20, // extra weight when a signal touches a gap (most actionable)
  region: 10,
  sector: 10,
  recency: 15,
};

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function containsTerm(haystack: string[], term: string): boolean {
  const t = term.toLowerCase();
  return haystack.some((h) => h === t || h.includes(t) || t.includes(h));
}

/** Recency multiplier: today ≈ 1.0, decaying to ~0 over 30 days. */
function recencyScore(publishedAt?: string): number {
  if (!publishedAt) return 0.3;
  const ts = new Date(publishedAt).getTime();
  if (Number.isNaN(ts)) return 0.3;
  const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  if (ageDays <= 0) return 1;
  return Math.max(0, 1 - ageDays / 30);
}

export function scoreSignal(signal: MarketSignal, profile: RelevanceProfile): ScoredSignal {
  const haystack = tokens(`${signal.title} ${signal.summary ?? ""}`).concat(
    signal.skills.map((s) => s.toLowerCase()),
  );
  const reasons: string[] = [];
  let score = 0;

  // Role
  const roleTokens = tokens(profile.targetRole);
  if (roleTokens.some((rt) => containsTerm(haystack, rt))) {
    score += WEIGHTS.role;
    reasons.push(`matches your target role (${profile.targetRole})`);
  }

  // Skills the user has / targets
  const matchedSkills = profile.skills.filter((s) => containsTerm(haystack, s));
  if (matchedSkills.length > 0) {
    score += Math.min(WEIGHTS.skill, matchedSkills.length * 12);
    reasons.push(`touches your skills: ${matchedSkills.slice(0, 3).join(", ")}`);
  }

  // Skill GAPS — the most actionable: industry moving toward something you lack.
  const matchedGaps = profile.skillGaps.filter((s) => containsTerm(haystack, s));
  if (matchedGaps.length > 0) {
    score += WEIGHTS.skillGap;
    reasons.push(`involves a skill gap you're working to close: ${matchedGaps.slice(0, 2).join(", ")}`);
  }

  // Region
  if (profile.region && signal.regions.some((r) => containsTerm([r.toLowerCase()], profile.region!))) {
    score += WEIGHTS.region;
    reasons.push(`relevant to your region (${profile.region})`);
  }

  // Sector
  const sectorMatch = (profile.sectors ?? []).filter((s) => containsTerm(haystack, s));
  if (sectorMatch.length > 0) {
    score += WEIGHTS.sector;
    reasons.push(`affects your sector: ${sectorMatch.slice(0, 2).join(", ")}`);
  }

  // Recency
  score += WEIGHTS.recency * recencyScore(signal.publishedAt);

  return {
    ...signal,
    relevance: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
  };
}

/** Score, filter below threshold, and rank. The output is what Kai may surface. */
export function rankSignals(
  signals: MarketSignal[],
  profile: RelevanceProfile,
  opts: { threshold?: number; limit?: number } = {},
): ScoredSignal[] {
  const threshold = opts.threshold ?? 35;
  const limit = opts.limit ?? 5;

  return signals
    .map((s) => scoreSignal(s, profile))
    .filter((s) => s.relevance >= threshold)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}
