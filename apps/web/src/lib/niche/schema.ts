import { z } from "zod";

/**
 * Niche Finder — the honest diagnostic for people paralyzed by choice (too many
 * branches in one field, or torn across fields). The user pours in their
 * situation; Fadi gathers REAL data (live postings + BLS) and Fadi returns an
 * un-sugar-coated reality per niche + a pathway, so they waste less time/money.
 */

export const nicheFinderInputSchema = z.object({
  situation: z.string().trim().min(20).max(4000),
  interests: z.string().trim().max(2000).optional().default(""),
  constraints: z.string().trim().max(2000).optional().default(""),
  location: z.string().trim().max(120).optional().default(""),
  /** Optional candidate niches the user is torn between. Empty → Fadi proposes. */
  candidateNiches: z.array(z.string().trim().min(2).max(80)).max(6).optional().default([]),
});
export type NicheFinderInput = z.infer<typeof nicheFinderInputSchema>;

/** Stage 1: structured candidate niches to investigate (drives live data fetch). */
export const nicheCandidateSchema = z.object({
  name: z.string(),
  domain: z.string(),
  /** The single role we search live postings for, to measure real demand. */
  anchorRole: z.string(),
  searchKeywords: z.string(),
});
export type NicheCandidate = z.infer<typeof nicheCandidateSchema>;

export const nicheCandidatesSchema = z.object({
  candidates: z.array(nicheCandidateSchema).min(2).max(5),
});

/** Real, non-AI evidence gathered per niche — shown so the verdict is auditable. */
export type NicheEvidence = {
  livePostingsSeen: number;
  sampleRoles: string[];
  salarySamples: string[];
  sources: string[];
};

/** Stage 2: Fadi's honest analysis per niche. Grounded in the evidence above. */
export const nicheAnalysisSchema = z.object({
  name: z.string(),
  domain: z.string(),
  /** One honest line — the headline truth about this niche for THIS person. */
  verdict: z.string(),
  demand: z.string(),
  payRange: z.string(),
  competition: z.enum(["low", "moderate", "high", "very_high"]),
  timeToBreakIn: z.string(),
  estimatedCost: z.string(),
  /** 0–100 fit given the person's transferable background. */
  fitScore: z.number().int().min(0).max(100),
  /** 0–100 honest probability of breaking in within ~12 months. */
  successProbability: z.number().int().min(0).max(100),
  transferableStrengths: z.array(z.string()).max(6),
  gaps: z.array(z.string()).max(6),
  pathway: z.array(z.object({ step: z.string(), detail: z.string() })).max(6),
});
export type NicheAnalysis = z.infer<typeof nicheAnalysisSchema>;

export const nicheReportSchema = z.object({
  /** Honest framing of where the person actually stands. */
  overview: z.string(),
  niches: z.array(nicheAnalysisSchema).min(1).max(5),
  /** Which to pick and why — a real recommendation, not a hedge. */
  recommendation: z.string(),
  /** The un-sugar-coated truth, including what NOT to do. */
  realityCheck: z.string(),
});
export type NicheReport = z.infer<typeof nicheReportSchema>;

/** What the engine returns: the AI report with real evidence merged per niche. */
export type NicheFinderResult = {
  overview: string;
  recommendation: string;
  realityCheck: string;
  niches: Array<NicheAnalysis & { evidence: NicheEvidence }>;
  /** Macro backdrop (BLS) shown once, honestly labelled US-national. */
  laborBackdrop: string | null;
};
