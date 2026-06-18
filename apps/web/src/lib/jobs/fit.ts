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

export type FitDimension = { id: FitDimensionId; label: string; weight: number; score: number; note: string };
export type FitVerdict = "apply" | "stretch" | "skip";

export type FitEvaluation = {
  overall: number; // 0–5, one decimal
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
  }
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
  input: { jobDescription: string; jobTitle?: string; company?: string },
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

  const [{ getCareerReportContext }, { composeCareerEvidence }, { getUserDocGenerate }] =
    await Promise.all([
      import("@/lib/career-report/data"),
      import("@/lib/career/evidence"),
      import("@/lib/ai/user-generate"),
    ]);

  const generate = await getUserDocGenerate(userId);
  if (!generate) {
    return {
      ok: false,
      reason: "no_provider",
      message: "Connect an AI provider in Settings and I'll run an honest fit check before you apply.",
    };
  }

  const ctx = await getCareerReportContext(userId);
  const evidence = composeCareerEvidence({
    resumeText: ctx?.resumeText,
    linkedInText: ctx?.linkedInProfileText,
  });

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

    const overall = overallScore(scores);
    const verdict = verdictFor(overall);
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
        verdictReason: verdictReason(verdict, overall),
        dimensions,
        topReasons: raw.topReasons.map((s) => s.trim()).filter(Boolean),
        gapsToClose: raw.gapsToClose.map((s) => s.trim()).filter(Boolean),
        redFlags: raw.redFlags.map((s) => s.trim()).filter(Boolean),
      },
    };
  } catch {
    return { ok: false, reason: "error", message: "I couldn't run the fit check just now — please try again." };
  }
}
