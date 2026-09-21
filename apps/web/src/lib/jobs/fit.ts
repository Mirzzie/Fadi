import { z } from "zod";

/**
 * The fit gate — "is THIS job worth your time, BEFORE you apply?"
 *
 * Different from the Application Quality Score (which rates how good your resume
 * is once you've decided to apply). This is the earlier, anti-spray decision the
 * ideology demands: the market is blunt (≈0.4% hire rate per app, ~242 apps per
 * posting — see market-research-2026), so focus beats volume. We score the
 * OPPORTUNITY against the candidate's real evidence and return an honest verdict:
 * apply / stretch / skip. Adapted from career-ops's A–F "don't apply below 4.0"
 * filter, generalized to any field and graded on a 0–5 scale.
 *
 * Pure helpers (overallScore / verdictFor / verdictReason) are unit-testable; the
 * AI evaluation loads server deps dynamically and never throws.
 */

export type FitDimensionId =
  | "roleMatch"
  | "seniorityFit"
  | "domainFit"
  | "trajectory"
  | "logistics"
  | "legitimacy";

export const FIT_DIMENSIONS: Array<{ id: FitDimensionId; label: string; weight: number }> = [
  { id: "roleMatch", label: "Role match", weight: 0.3 },
  { id: "seniorityFit", label: "Seniority fit", weight: 0.15 },
  { id: "domainFit", label: "Field/industry fit", weight: 0.15 },
  { id: "trajectory", label: "Advances your goal", weight: 0.2 },
  { id: "logistics", label: "Location & logistics", weight: 0.1 },
  { id: "legitimacy", label: "Posting legitimacy", weight: 0.1 },
];

export type FitDimension = {
  id: FitDimensionId;
  label: string;
  weight: number;
  score: number;
  note: string;
};

/**
 * ELIGIBILITY IS NOT A SCORE.
 *
 * Two of the six dimensions are not preferences at all. "Can I legally and physically
 * take this job" and "is this posting real" are gates: failing either makes the other
 * four irrelevant, and no amount of keyword match repairs them.
 *
 * Averaged in at 10% each they could be outweighed. Codex reproduced it: role,
 * seniority, domain and trajectory at 5 with logistics and legitimacy at 0 returned
 * 4.0/5 and "Strong fit — worth a genuinely tailored application". Fadi was confidently
 * recommending hours of work on a posting its own model had scored zero for legitimacy.
 *
 * `unknown` is a first-class state, distinct from `fail`. A model that is unsure whether
 * a posting is genuine has not established fraud, and treating low confidence as proof
 * would be the same overreach in the opposite direction. Unknown produces a question.
 */
export type Eligibility = "pass" | "fail" | "unknown";
export type EligibilityId = "logistics" | "legitimacy";

export type EligibilityCheck = {
  id: EligibilityId;
  label: string;
  state: Eligibility;
  /** Always populated — a gate that blocks without saying why is not reviewable. */
  reason: string;
  /**
   * Whether the user may knowingly proceed anyway. Logistics is often negotiable
   * (someone may relocate, or accept the commute); legitimacy is not something to
   * click past, so it routes to review rather than offering an override.
   */
  overridable: boolean;
};

/**
 * "blocked" and "check" are not points on the apply/stretch/skip scale — they are the
 * absence of a recommendation. Keeping them in the same union stops any caller from
 * treating a blocked posting as merely a low score.
 */
export type FitVerdict = "apply" | "stretch" | "skip" | "check" | "blocked";

export type FitEvaluation = {
  /** Relevance across the four MATCHING dimensions only — not a recommendation. */
  overall: number; // 0–5, one decimal
  /** The gates, always present, each with its reason. */
  eligibility: EligibilityCheck[];
  verdict: FitVerdict;
  verdictReason: string;
  dimensions: FitDimension[];
  topReasons: string[];
  gapsToClose: string[];
  redFlags: string[];
};

/** Below this overall, we advise against applying — focus your time elsewhere. */
export const FIT_FLOOR = 2.8;
const APPLY_BAR = 3.8;

/** The gates. Everything else is relevance, and relevance is ranked only after these. */
export const ELIGIBILITY_IDS: EligibilityId[] = ["logistics", "legitimacy"];
/** The four that describe how well the work matches — the only ones that get averaged. */
export const RELEVANCE_IDS: FitDimensionId[] = [
  "roleMatch",
  "seniorityFit",
  "domainFit",
  "trajectory",
];

/**
 * A 0–5 dimension score becomes a gate state.
 *
 * The band matters: a model asked to rate legitimacy 0–5 expresses "this looks like a
 * scam" and "I could not tell" with similar low numbers, so a bare threshold would
 * convert uncertainty into an accusation. Only a clear low score fails; the middle is
 * explicitly unknown and asks.
 */
export function eligibilityFrom(score: number | undefined): Eligibility {
  if (score == null || Number.isNaN(score)) return "unknown";
  if (score <= 1) return "fail";
  if (score < 3) return "unknown";
  return "pass";
}

const ELIGIBILITY_LABEL: Record<EligibilityId, string> = {
  logistics: "Location & logistics",
  legitimacy: "Posting legitimacy",
};

export function eligibilityChecks(
  scores: Partial<Record<FitDimensionId, number>>,
  notes: Partial<Record<EligibilityId, string>> = {}
): EligibilityCheck[] {
  return ELIGIBILITY_IDS.map((id) => {
    const state = eligibilityFrom(scores[id]);
    return {
      id,
      label: ELIGIBILITY_LABEL[id],
      state,
      reason:
        notes[id]?.trim() ||
        (state === "pass"
          ? "No problem found."
          : state === "fail"
            ? id === "logistics"
              ? "This looks impossible from where you are, on the terms offered."
              : "This posting has the markers of one that isn't real."
            : id === "logistics"
              ? "The posting doesn't say enough about location or eligibility to tell."
              : "Not enough about this posting to judge whether it's genuine."),
      // Legitimacy is never a click-through. Logistics often is: people relocate.
      overridable: id === "logistics",
    };
  });
}

/**
 * Relevance across the four matching dimensions ONLY, renormalised over their own
 * weights so removing the gates does not silently deflate every score.
 */
export function relevanceScore(scores: Partial<Record<FitDimensionId, number>>): number {
  let sum = 0;
  let weight = 0;
  for (const d of FIT_DIMENSIONS) {
    if (!RELEVANCE_IDS.includes(d.id)) continue;
    sum += clamp05(scores[d.id] ?? 0) * d.weight;
    weight += d.weight;
  }
  return Math.round((weight > 0 ? sum / weight : 0) * 10) / 10;
}

/**
 * Eligibility first, relevance second — the order is the fix.
 *
 * A failed gate returns "blocked" whatever the relevance, and an unresolved one returns
 * "check", which is a request to establish a fact rather than a judgement about the job.
 */
export function gatedVerdict(
  checks: EligibilityCheck[],
  relevance: number
): { verdict: FitVerdict; blocking: EligibilityCheck[] } {
  const failed = checks.filter((c) => c.state === "fail");
  if (failed.length > 0) return { verdict: "blocked", blocking: failed };

  const unresolved = checks.filter((c) => c.state === "unknown");
  if (unresolved.length > 0) return { verdict: "check", blocking: unresolved };

  return { verdict: verdictFor(relevance), blocking: [] };
}

const clamp05 = (n: number) => Math.max(0, Math.min(5, n));

/** Weighted 0–5 overall from the per-dimension scores. Pure. */
export function overallScore(scores: Record<FitDimensionId, number>): number {
  let sum = 0;
  let weight = 0;
  for (const d of FIT_DIMENSIONS) {
    sum += clamp05(scores[d.id] ?? 0) * d.weight;
    weight += d.weight;
  }
  const avg = weight > 0 ? sum / weight : 0;
  return Math.round(avg * 10) / 10;
}

export function verdictFor(overall: number): FitVerdict {
  if (overall >= APPLY_BAR) return "apply";
  if (overall >= FIT_FLOOR) return "stretch";
  return "skip";
}

export function verdictReason(verdict: FitVerdict, overall: number): string {
  switch (verdict) {
    case "apply":
      return `Strong fit (${overall.toFixed(1)}/5). This clears the bar — worth a genuinely tailored application.`;
    case "stretch":
      return `A stretch (${overall.toFixed(1)}/5). Only worth your time if you can close the gaps below, or you have a referral in. Otherwise that time converts better on closer-fit roles.`;
    case "skip":
      return `Below the bar (${overall.toFixed(1)}/5). The data is blunt: low-fit applications rarely convert and burn time you can't get back. Skip it — or turn it into a referral play — and aim your energy at roles you actually fit.`;
    // Neither of these is a judgement about how well you match. They exist so the
    // caller cannot render a gate outcome as a score, and both are replaced by
    // `gateReason()` with the specific check that produced them.
    case "check":
      return "Something about this posting needs establishing before a recommendation means anything.";
    case "blocked":
      return "This one is ruled out on the facts, not on how well you match it.";
  }
}

/** The specific, quotable reason a gate produced its outcome. */
export function gateReason(verdict: FitVerdict, blocking: EligibilityCheck[]): string {
  if (blocking.length === 0) return "";
  const list = blocking.map((c) => `${c.label.toLowerCase()} — ${c.reason}`).join(" ");
  return verdict === "blocked"
    ? `Ruled out: ${list} Relevance is not the question here; a strong match cannot make an impossible or fake posting worth your time.`
    : `Worth checking first: ${list} Establish that, and the fit assessment below means something.`;
}

const dim = z.object({ score: z.number().min(0).max(5), note: z.string() });
const fitSchema = z.object({
  roleMatch: dim,
  seniorityFit: dim,
  domainFit: dim,
  trajectory: dim,
  logistics: dim,
  legitimacy: dim,
  topReasons: z.array(z.string()).max(5),
  gapsToClose: z.array(z.string()).max(5),
  redFlags: z.array(z.string()).max(5),
});

const SYSTEM = `You are a candid career mentor running a FIT CHECK: should this specific candidate spend their limited time applying to THIS specific job? This is NOT a résumé-quality score — it's whether the opportunity is worth pursuing for them.

Score each dimension 0–5 (0 = no fit, 5 = excellent), grounded ONLY in the evidence and job description provided:
- roleMatch: do their actual skills/experience meet the must-haves?
- seniorityFit: is the level right (not wildly over/under)?
- domainFit: does their field/industry background transfer?
- trajectory: does this move them toward their stated goal (not sideways/backward)?
- logistics: location/remote/visa/comp realism vs their situation.
- legitimacy: signs of a ghost job, scam, or uselessly vague posting (lower = more red flags).

Rules:
- Be calibrated, do NOT inflate. Most real-world roles are a 2–3.5; reserve 4+ for genuinely strong fit. A spray-friendly grader is useless.
- Use only what's given. Never invent the candidate's experience. If the JD or evidence is too thin to judge a dimension, score it conservatively and say so in the note.
- gapsToClose: concrete, controllable steps. redFlags: real signals from the posting only.`;

export type FitResult =
  | { ok: true; evaluation: FitEvaluation }
  | { ok: false; reason: "no_jd" | "no_provider" | "error"; message: string };

export async function evaluateFit(
  userId: string,
  input: { jobDescription: string; jobTitle?: string; company?: string }
): Promise<FitResult> {
  const jd = (input.jobDescription ?? "").trim();
  if (!jd) {
    return {
      ok: false,
      reason: "no_jd",
      message:
        "I need the job description to judge fit. Paste it into the workspace and I'll tell you honestly whether it's worth your time.",
    };
  }

  const [{ getCareerReportContext }, { approvedCareerEvidence }, { getUserDocGenerate }] =
    await Promise.all([
      import("@/lib/career-report/data"),
      import("@/lib/career/context"),
      import("@/lib/ai/user-generate"),
    ]);

  const generate = await getUserDocGenerate(userId);
  if (!generate) {
    return {
      ok: false,
      reason: "no_provider",
      message:
        "Connect an AI provider in Settings and I'll run an honest fit check before you apply.",
    };
  }

  const ctx = await getCareerReportContext(userId);
  const evidence = await approvedCareerEvidence(userId, { directionId: ctx?.careerProfileId });
  const user = [
    `Candidate's goal/target role: ${ctx?.targetRole ?? "not specified"}`,
    `Field/industry: ${ctx?.domain ?? "not specified"}`,
    `Experience level: ${ctx?.experienceLevel ?? "not specified"}`,
    `Location preference: ${ctx?.locationPreference ?? "not specified"}`,
    "",
    evidence.block,
    "",
    `JOB — ${input.jobTitle ?? "(title n/a)"}${input.company ? ` at ${input.company}` : ""}:`,
    jd.slice(0, 6000),
  ].join("\n");

  try {
    const raw = await generate.structured(SYSTEM, user, fitSchema, "job_fit");
    const scores = {
      roleMatch: raw.roleMatch.score,
      seniorityFit: raw.seniorityFit.score,
      domainFit: raw.domainFit.score,
      trajectory: raw.trajectory.score,
      logistics: raw.logistics.score,
      legitimacy: raw.legitimacy.score,
    } as Record<FitDimensionId, number>;

    // ELIGIBILITY FIRST. `overall` is kept as the relevance number and is no longer the
    // thing that decides — the two gates are removed from the average entirely rather
    // than weighted at 10%, because a gate that can be outvoted is not a gate.
    const checks = eligibilityChecks(scores, {
      logistics: raw.logistics.note,
      legitimacy: raw.legitimacy.note,
    });
    const overall = relevanceScore(scores);
    const { verdict, blocking } = gatedVerdict(checks, overall);
    const dimensions: FitDimension[] = FIT_DIMENSIONS.map((d) => ({
      ...d,
      score: clamp05(scores[d.id]),
      note: raw[d.id].note.trim(),
    }));

    return {
      ok: true,
      evaluation: {
        overall,
        verdict,
        eligibility: checks,
        verdictReason:
          blocking.length > 0 ? gateReason(verdict, blocking) : verdictReason(verdict, overall),
        dimensions,
        topReasons: raw.topReasons.map((s) => s.trim()).filter(Boolean),
        gapsToClose: raw.gapsToClose.map((s) => s.trim()).filter(Boolean),
        redFlags: raw.redFlags.map((s) => s.trim()).filter(Boolean),
      },
    };
  } catch {
    return {
      ok: false,
      reason: "error",
      message: "I couldn't run the fit check just now — please try again.",
    };
  }
}
