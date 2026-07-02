import { z } from "zod";

/**
 * The red-pen CV review — a brutally honest, section-by-section recruiter review
 * of the CV against ONE specific job description, with before/after rewrites.
 * Complements (does not duplicate) the Application Quality Scorer: the scorer is
 * the quick "is it ready to send?" gate; this is the deep written review a senior
 * recruiter would give — 🔴 critical / 🟠 reframe / 🟢 strength / 🔵 advantage.
 *
 * Honesty rules carried from the platform mandate: quote only what's actually in
 * the CV, never invent experience or metrics (rewrites use [ADD REAL NUMBER]
 * placeholders), strengths only when genuinely earned, no motivational padding.
 */

export type ReviewVerdict = "critical" | "reframe" | "strength" | "advantage";

export interface CvReviewSection {
  name: string;
  jdDemands: string;
  cvSays: string;
  diagnosis: string;
  verdict: ReviewVerdict;
  rewrite: string;
}

export interface CvReview {
  sections: CvReviewSection[];
  atsScore: number; // 0–100 keyword-match estimate
  missingKeywords: string[];
  sixSecondImpression: string;
  topCriticalFixes: string[];
  quickWins: string[];
  hireProbability: { decision: "shortlist" | "maybe" | "bin"; reason: string };
}

export type CvReviewResult =
  | { ok: true; review: CvReview }
  | { ok: false; reason: "no_jd" | "no_resume" | "no_provider" | "error"; message: string };

/** Pure: normalise a provider's free-text verdict onto the 4 known kinds. */
export function toVerdict(raw: string | undefined): ReviewVerdict {
  const v = (raw ?? "").toLowerCase();
  if (v.includes("critical") || v.includes("red")) return "critical";
  if (v.includes("strength") || v.includes("green")) return "strength";
  if (v.includes("advantage") || v.includes("blue")) return "advantage";
  return "reframe";
}

/** Pure: clamp a provider score into 0–100. */
export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));
}

// Providers vary in structured-output discipline (the mock-interview lesson), so
// the schema is deliberately tolerant: strings for enums, coerced numbers,
// defaulted arrays. Normalisation happens after parse.
const reviewSchema = z.object({
  sections: z
    .array(
      z.object({
        name: z.string(),
        jdDemands: z.string().default(""),
        cvSays: z.string().default(""),
        diagnosis: z.string().default(""),
        verdict: z.string().default("reframe"),
        rewrite: z.string().default(""),
      }),
    )
    .max(12)
    .default([]),
  atsScore: z.coerce.number().default(0),
  missingKeywords: z.array(z.string()).max(12).default([]),
  sixSecondImpression: z.string().default(""),
  topCriticalFixes: z.array(z.string()).max(3).default([]),
  quickWins: z.array(z.string()).max(3).default([]),
  hireDecision: z.string().default("maybe"),
  hireReason: z.string().default(""),
});

const SYSTEM = `You are a brutally honest senior recruiter with 15+ years of in-house and agency hiring experience in the candidate's field. You have reviewed thousands of CVs and know exactly what hiring managers discard in 6 seconds and why. You review this CV as the hiring manager for THIS exact role — like a red-pen teacher marking an essay: specific, clinical, merciless where warranted. You do not flatter. You do not hedge. No motivational padding.

Review section by section (contact/header, summary, each work-experience role separately, education & certifications, skills, any other sections that actually exist in the CV). For each section provide:
- jdDemands: the exact signals/keywords/competencies THIS job description requires that are relevant to the section
- cvSays: quote or closely paraphrase what the CV ACTUALLY says (never invent content)
- diagnosis: specific and cynical — call out vague language, missing metrics, weak/passive verbs, buzzword padding, job-description-instead-of-achievements, unexplained gaps. "This bullet is weak" is useless; "this bullet has no metric, no outcome, and a passive verb — rewrite it" is useful.
- verdict: exactly one of critical (would get this CV binned) | reframe (exists but framed wrong) | strength (genuinely working — ONLY if true) | advantage (underused asset positioned wrong)
- rewrite: the section as it SHOULD appear — strong action verbs, quantified impact, JD-aligned language. HARD RULE: reshape only what the candidate actually has. Where a metric is missing, write [ADD REAL NUMBER] — NEVER invent numbers, employers, dates, or achievements.

Then the overall verdict:
- atsScore: keyword-match estimate 0–100 against THIS JD, with missingKeywords drawn ONLY from the actual JD
- sixSecondImpression: what a recruiter honestly thinks in the first 6 seconds
- topCriticalFixes (max 3, must-do before applying) and quickWins (max 3, easy rewrites)
- hireDecision: shortlist | maybe | bin — if this CV landed on your desk for this exact role right now — with hireReason (one honest paragraph)

Strength verdicts only when genuinely earned. Fewer, sharper sections beat padded ones.`;

/**
 * Run the red-pen review. `generate` is the user's BYO provider chain (same seam
 * as fit/prep/brief); resume text should be the CV they'd actually send for this
 * job (tailored doc when it exists, else the base resume).
 */
export async function runCvReview(
  generate: {
    structured: <T>(system: string, user: string, schema: z.ZodType<T>, name: string) => Promise<T>;
  },
  input: { jobTitle: string; company: string; jobDescription: string; resumeText: string },
): Promise<CvReviewResult> {
  const jd = input.jobDescription.trim();
  if (!jd) {
    return {
      ok: false,
      reason: "no_jd",
      message: "I need the job description to review against — this review is JD-specific by design.",
    };
  }
  if (!input.resumeText.trim()) {
    return {
      ok: false,
      reason: "no_resume",
      message: "There's no CV to review yet. Add your resume in Profile, or draft one in this workspace.",
    };
  }

  const user = [
    `Role: ${input.jobTitle} at ${input.company}`,
    "",
    "JOB DESCRIPTION:",
    jd.slice(0, 6000),
    "",
    "CANDIDATE CV:",
    input.resumeText.slice(0, 8000),
  ].join("\n");

  try {
    const raw = await generate.structured(SYSTEM, user, reviewSchema, "cv_red_pen_review");
    const decision = raw.hireDecision.toLowerCase();
    const review: CvReview = {
      sections: raw.sections
        .filter((s) => s.name.trim() && (s.diagnosis.trim() || s.rewrite.trim()))
        .map((s) => ({
          name: s.name.trim(),
          jdDemands: s.jdDemands.trim(),
          cvSays: s.cvSays.trim(),
          diagnosis: s.diagnosis.trim(),
          verdict: toVerdict(s.verdict),
          rewrite: s.rewrite.trim(),
        })),
      atsScore: clampScore(raw.atsScore),
      missingKeywords: raw.missingKeywords.map((k) => k.trim()).filter(Boolean),
      sixSecondImpression: raw.sixSecondImpression.trim(),
      topCriticalFixes: raw.topCriticalFixes.map((f) => f.trim()).filter(Boolean),
      quickWins: raw.quickWins.map((f) => f.trim()).filter(Boolean),
      hireProbability: {
        decision: decision.includes("shortlist") ? "shortlist" : decision.includes("bin") ? "bin" : "maybe",
        reason: raw.hireReason.trim(),
      },
    };
    if (review.sections.length === 0) {
      return { ok: false, reason: "error", message: "The review came back empty — try again in a moment." };
    }
    return { ok: true, review };
  } catch {
    return {
      ok: false,
      reason: "error",
      message: "I couldn't complete the review just now — check your AI provider and try again.",
    };
  }
}
