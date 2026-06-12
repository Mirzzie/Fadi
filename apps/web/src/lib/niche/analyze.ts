import "server-only";

import type { AIProvider } from "@/lib/ai/providers/types";
import { discoverJobs } from "@/lib/data-sources/service";
import { formatShiftsForPrompt, relevantShiftsFor } from "@/lib/intelligence/world-shifts";
import { getLaborMarketSnapshot } from "@/lib/labor-market/bls";
import { parseLocation } from "@/lib/jobs/locations";
import { logger } from "@/lib/observability/logger";

import {
  nicheCandidatesSchema,
  nicheReportSchema,
  type NicheCandidate,
  type NicheEvidence,
  type NicheFinderInput,
  type NicheFinderResult,
} from "./schema";

const SYSTEM = `You are Kai, CareerOS's career intelligence. You help people who are PARALYZED by career choice make a grounded decision and stop wasting time and money.

Rules:
- Be HONEST and specific, never a cheerleader. If a niche is a long shot for this person, say so plainly and say why.
- GROUND every demand/pay claim in the real evidence provided (live job postings + macro labor data). If evidence is thin, say demand is "unclear from current data" — do not invent numbers.
- successProbability is your honest estimate of breaking in within ~12 months given THIS person's background and constraints. Low is fine — being wrong here costs them real money.
- Reward transferable strengths; be candid about gaps and the real time/cost to close them.
- Work for ANY field (finance, healthcare, trades, design, tech…), not just tech.
- Rank niches by what's genuinely best for this person, blending fit, real demand, and feasibility — not by what sounds exciting.`;

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Stage 1 — turn the user's situation (and any niches they named) into a small,
 *  structured set of candidates we can pull live data for. */
async function resolveNiches(
  provider: AIProvider,
  input: NicheFinderInput,
): Promise<NicheCandidate[]> {
  const named =
    input.candidateNiches.length > 0
      ? `The person is specifically torn between these: ${input.candidateNiches.join("; ")}. Use these as the candidates (refine names if needed).`
      : `The person did not name specific niches — propose 3-4 realistic candidates given their situation and interests. Span branches within a field AND adjacent fields where it makes sense.`;

  const { candidates } = await provider.parseStructured(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Resolve career-niche candidates to investigate.

Situation: ${input.situation}
Interests: ${input.interests || "(not specified)"}
Constraints: ${input.constraints || "(not specified)"}
Location: ${input.location || "(not specified)"}

${named}

For each candidate give: name, domain (industry), anchorRole (the single most representative job title to search live postings for), and searchKeywords (2-5 words for a job search).`,
      },
    ],
    nicheCandidatesSchema,
    "niche_candidates",
    { temperature: 0.5 },
  );

  return candidates;
}

/** Real, auditable demand evidence for one niche — live postings, no AI. */
async function gatherEvidence(
  candidate: NicheCandidate,
  location: string,
): Promise<NicheEvidence> {
  try {
    const loc = parseLocation(location || undefined);
    const postings = await discoverJobs(
      {
        targetRole: candidate.anchorRole,
        skills: [],
        skillGaps: [],
        region: location || null,
        domain: candidate.domain,
      },
      12,
      { country: loc.country, city: loc.city },
    );

    const sampleRoles = [...new Set(postings.map((p) => p.title))].slice(0, 5);
    const salarySamples = [
      ...new Set(postings.map((p) => p.salaryText).filter((s): s is string => Boolean(s))),
    ].slice(0, 3);
    const sources = [...new Set(postings.map((p) => p.sourceId))];

    return { livePostingsSeen: postings.length, sampleRoles, salarySamples, sources };
  } catch (err) {
    logger.warn("niche.evidence_failed", {
      niche: candidate.name,
      error: err instanceof Error ? err.message : "unknown",
    });
    return { livePostingsSeen: 0, sampleRoles: [], salarySamples: [], sources: [] };
  }
}

function evidenceForPrompt(c: NicheCandidate, e: NicheEvidence): string {
  return [
    `### ${c.name} (${c.domain})`,
    `Live postings found for "${c.anchorRole}"${
      e.livePostingsSeen === 0 ? "" : ` in the user's area`
    }: ${e.livePostingsSeen}`,
    e.sampleRoles.length ? `Sample real roles: ${e.sampleRoles.join("; ")}` : "Sample real roles: none returned",
    e.salarySamples.length ? `Salary signals seen: ${e.salarySamples.join(" | ")}` : "Salary signals seen: none disclosed in postings",
    e.sources.length ? `Sources: ${e.sources.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Orchestrator: resolve → gather real evidence → honest grounded analysis. */
export async function runNicheFinder(
  provider: AIProvider,
  input: NicheFinderInput,
): Promise<NicheFinderResult> {
  const [candidates, bls] = await Promise.all([
    resolveNiches(provider, input),
    getLaborMarketSnapshot(),
  ]);

  const evidences = await Promise.all(
    candidates.map((c) => gatherEvidence(c, input.location)),
  );

  const evidenceBlock = candidates
    .map((c, i) => evidenceForPrompt(c, evidences[i]))
    .join("\n\n");

  const report = await provider.parseStructured(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Give an honest niche analysis so this person can decide and stop wasting time/money.

## The person
Situation: ${input.situation}
Interests: ${input.interests || "(not specified)"}
Constraints: ${input.constraints || "(not specified)"}
Location: ${input.location || "(not specified)"}

## Real demand evidence (live job postings gathered just now — ground your demand/pay claims in this)
${evidenceBlock}

## Macro labor backdrop (US national, BLS — context only, not niche-specific)
${bls.summary || "Not available."}

## Structural global forces (curated + sourced — weigh each niche against these, as positioning not prophecy)
${formatShiftsForPrompt(
  relevantShiftsFor(
    candidates.map((c) => c.anchorRole).join(" "),
    candidates.map((c) => c.domain).join(" "),
  ),
)}

Return: an honest overview of where they stand; one analysis per niche above (SAME names, ordered best-fit first); a real recommendation of which to pursue and why; and a reality check naming what to avoid. For each niche set successProbability honestly (low is fine) and base demand on the live postings count — if a niche returned 0 postings, treat demand as unproven and say so.`,
      },
    ],
    nicheReportSchema,
    "niche_report",
    { temperature: 0.45 },
  );

  // Merge the REAL evidence back in (by name, then index) so the UI shows the
  // data each verdict is built on — the verdict is never the only thing on screen.
  const byName = new Map(candidates.map((c, i) => [norm(c.name), evidences[i]]));
  const empty: NicheEvidence = { livePostingsSeen: 0, sampleRoles: [], salarySamples: [], sources: [] };

  const niches = report.niches.map((n, i) => ({
    ...n,
    evidence: byName.get(norm(n.name)) ?? evidences[i] ?? empty,
  }));

  logger.info("niche.completed", {
    candidates: candidates.length,
    returned: niches.length,
    totalPostings: evidences.reduce((sum, e) => sum + e.livePostingsSeen, 0),
  });

  return {
    overview: report.overview,
    recommendation: report.recommendation,
    realityCheck: report.realityCheck,
    niches,
    laborBackdrop: bls.summary || null,
  };
}
