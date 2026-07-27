import { z } from "zod";

import { DOC_GUIDANCE } from "@/lib/documents/doc-guidance";
import type { ProseKind } from "@/lib/documents/letter";

/**
 * The red-pen review — a brutally honest, section-by-section recruiter review of
 * a document (CV, cover letter, cold email, or value proposition) against ONE
 * specific job description, with before/after rewrites. Complements (does not
 * duplicate) the Application Quality Scorer: the scorer is the quick "is it ready
 * to send?" gate; this is the deep written review a senior recruiter would give —
 * 🔴 critical / 🟠 reframe / 🟢 strength / 🔵 advantage.
 *
 * Honesty rules carried from the platform mandate: quote only what's actually in
 * the document, never invent experience or metrics (rewrites use [ADD REAL NUMBER]
 * placeholders), strengths only when genuinely earned, no motivational padding.
 */

export type ReviewableKind = "resume" | ProseKind;

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

/**
 * Pure: turn a completed review into redraft guidance — the fixes + rewrites the
 * generator must incorporate. Capped so a huge review can't blow up the prompt.
 */
export function reviewToGuidance(review: CvReview, maxChars = 4000): string {
  const parts: string[] = [];
  if (review.topCriticalFixes.length > 0) {
    parts.push(`MUST FIX:\n${review.topCriticalFixes.map((f) => `- ${f}`).join("\n")}`);
  }
  if (review.quickWins.length > 0) {
    parts.push(`QUICK WINS:\n${review.quickWins.map((f) => `- ${f}`).join("\n")}`);
  }
  for (const s of review.sections) {
    if (s.verdict === "strength" || !s.rewrite) continue;
    parts.push(`${s.name.toUpperCase()} (${s.verdict}): ${s.diagnosis}\nRewrite toward:\n${s.rewrite}`);
  }
  return parts.join("\n\n").slice(0, maxChars);
}

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
        jdDemands: z.string(),
        cvSays: z.string(),
        diagnosis: z.string(),
        verdict: z.string(),
        rewrite: z.string(),
      }),
    )
    .max(12),
  atsScore: z.coerce.number(),
  missingKeywords: z.array(z.string()).max(12),
  sixSecondImpression: z.string(),
  topCriticalFixes: z.array(z.string()).max(3),
  quickWins: z.array(z.string()).max(3),
  hireDecision: z.string(),
  hireReason: z.string(),
});

/** Per-kind framing: what "sections" means + the recruiter's bar for this document. */
const KIND_BRIEF: Record<ReviewableKind, { label: string; sections: string; bar: string }> = {
  resume: {
    label: "CV",
    sections:
      "contact/header, summary, each work-experience role separately, education & certifications, skills, any other sections that actually exist",
    bar: "Call out vague language, missing metrics, weak/passive verbs, buzzword padding, job-description-instead-of-achievements, unexplained gaps.",
  },
  cover_letter: {
    label: "cover letter",
    sections: "opening hook, body/fit paragraphs (each separately), proof point, close",
    bar: "The bar: 250–400 words total; the first 40–60 words must name the role and lead with a specific result — 'I am writing to apply' is an instant skim-past. Every paragraph must earn its place in a sub-30-second read.",
  },
  email: {
    label: "cold email",
    sections: "subject line, opening line, body, the ask/close",
    bar: "The bar: 50–150 words total (101–150 is the engagement sweet spot); a 6–10-word specific subject; genuine personalization (something real about THIS company); exactly ONE low-friction ask. Anything generic reads as a mass blast and gets 2–3% replies instead of ~7.5%.",
  },
  value_proposition: {
    label: "value proposition",
    sections: "headline/positioning, future-impact section, proof points, close",
    bar: "The bar: ~120–180 words; lead with the first things you'd fix/improve in the role — not a recap of past duties; quantified proof separates you from the field.",
  },
};

/** Extra rubric lines pulled from the in-app recruiter guidance (single source of truth). */
function rubricFor(kind: ReviewableKind): string {
  if (kind === "resume") return "";
  const g = DOC_GUIDANCE[kind];
  if (!g) return "";
  return `\nRecruiter rubric for this ${KIND_BRIEF[kind].label} (${g.words.min}–${g.words.max} words — ${g.words.note}; sources: ${g.sources}):\n${g.tips.map((t) => `- ${t.label}: ${t.text}`).join("\n")}`;
}

function systemFor(kind: ReviewableKind): string {
  const k = KIND_BRIEF[kind];
  return `You are a brutally honest senior recruiter with 15+ years of in-house and agency hiring experience in the candidate's field. You have reviewed thousands of ${k.label}s and know exactly what hiring managers discard in 6 seconds and why. You review this ${k.label} as the hiring manager for THIS exact role — like a red-pen teacher marking an essay: specific, clinical, merciless where warranted. You do not flatter. You do not hedge. No motivational padding.

Review section by section (${k.sections}). For each section provide:
- jdDemands: the exact signals/keywords/competencies THIS job description requires that are relevant to the section
- cvSays: quote or closely paraphrase what the ${k.label} ACTUALLY says (never invent content)
- diagnosis: specific and cynical. ${k.bar} "This is weak" is useless; "this has no metric, no outcome, and a passive verb — rewrite it" is useful.
- verdict: exactly one of critical (would get this ${k.label} binned) | reframe (exists but framed wrong) | strength (genuinely working — ONLY if true) | advantage (underused asset positioned wrong)
- rewrite: the section as it SHOULD appear — strong action verbs, quantified impact, JD-aligned language. HARD RULE: reshape only what the candidate actually has. Where a metric is missing, write [ADD REAL NUMBER] — NEVER invent numbers, employers, dates, or achievements.
${rubricFor(kind)}
Then the overall verdict:
- atsScore: keyword/JD-alignment estimate 0–100 against THIS JD, with missingKeywords drawn ONLY from the actual JD
- sixSecondImpression: what a recruiter honestly thinks in the first 6 seconds
- topCriticalFixes (max 3, must-do before sending) and quickWins (max 3, easy rewrites)
- hireDecision: shortlist | maybe | bin — if this ${k.label} landed on your desk for this exact role right now — with hireReason (one honest paragraph)

Strength verdicts only when genuinely earned. Fewer, sharper sections beat padded ones.`;
}

/**
 * Run the red-pen review on any reviewable document kind. `generate` is the
 * user's BYO provider chain (same seam as fit/prep/brief); `docText` should be
 * the document they'd actually send for this job.
 */
export async function runDocReview(
  generate: {
    structured: <T>(system: string, user: string, schema: z.ZodType<T>, name: string) => Promise<T>;
  },
  input: {
    kind: ReviewableKind;
    jobTitle: string;
    company: string;
    jobDescription: string;
    docText: string;
  },
): Promise<CvReviewResult> {
  const label = KIND_BRIEF[input.kind].label;
  const jd = input.jobDescription.trim();
  if (!jd) {
    return {
      ok: false,
      reason: "no_jd",
      message: "I need the job description to review against — this review is JD-specific by design.",
    };
  }
  if (!input.docText.trim()) {
    return {
      ok: false,
      reason: "no_resume",
      message: `There's no ${label} to review yet — draft one first (auto-prep or the draft buttons), then I'll mark it up.`,
    };
  }

  const user = [
    `Role: ${input.jobTitle} at ${input.company}`,
    "",
    "JOB DESCRIPTION:",
    jd.slice(0, 6000),
    "",
    `CANDIDATE ${label.toUpperCase()}:`,
    input.docText.slice(0, 8000),
  ].join("\n");

  try {
    const raw = await generate.structured(systemFor(input.kind), user, reviewSchema, "doc_red_pen_review");
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
  } catch (error) {
    // LOG THE CAUSE — see the same fix in lib/evidence/pool.ts. A bare `catch {}` on an
    // AI path turns a 100%-reproducible failure into an invisible one: the user is told
    // to "check your AI provider" when the provider is fine and the schema is at fault.
    const { logger } = await import("@/lib/observability/logger");
    logger.error("cv_review.failed", {
      kind: input.kind,
      jdChars: input.jobDescription.length,
      docChars: input.docText.length,
      error: error instanceof Error ? `${error.name}: ${error.message}` : "unknown",
    });
    return {
      ok: false,
      reason: "error",
      message: "I couldn't complete the review just now — check your AI provider and try again.",
    };
  }
}
