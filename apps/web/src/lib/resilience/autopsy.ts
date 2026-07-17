import { z } from "zod";

/**
 * Rejection autopsy — the analytical half of the Resilience Engine. The service
 * layer records the *momentum* for facing and reflecting on a "no"; this turns
 * that "no" into INFORMATION: a named pattern across the user's rejections and a
 * sharper next application.
 *
 * Honesty mandate (see framing.ts + the psychological-lens mandate):
 *  - Ground every claim ONLY in the user's real data. Never invent feedback.
 *  - Name a pattern only when ≥2 rejections actually support it; otherwise say so.
 *  - Locus of control: every "sharper next" step is something the user controls.
 *  - The reframe is honest, not toxic positivity — it never denies the difficulty.
 *
 * The pure helpers here (buildAutopsyContext / heuristicPattern / heuristicInsight)
 * are import-safe for tests; the AI provider is loaded dynamically so this module
 * stays usable without pulling in server-only code.
 */

export type AutopsyApplication = {
  company: string;
  title: string;
  jobDescription?: string | null;
  rejectionStage?: string | null;
};

export type RejectionReflection = {
  stage?: string;
  feedback?: string;
  lesson?: string;
  nextAction?: string;
};

export type RejectionPattern = { name: string; evidence: string };

export type RejectionInsight = {
  /** A cross-rejection pattern, or null when there isn't enough data to claim one honestly. */
  pattern: RejectionPattern | null;
  /** 2–4 concrete, controllable moves that make the next application stronger. */
  sharperNextApplication: string[];
  /** An honest, locus-of-control reframe — never toxic positivity. */
  reframe: string;
};

/** Where a rejection happened, in plain language. */
const STAGE_LABEL: Record<string, string> = {
  keyword: "no response (filtered before a human)",
  screen: "early screen",
  interview: "after an interview",
  final: "final round",
};

const SYSTEM = `You are Fadi, an honest career mentor running a "rejection autopsy". Your ONLY job is to turn a job rejection into useful information for the user's NEXT application.

Hard rules:
- Use ONLY the facts provided. Never invent recruiter feedback, reasons, or numbers.
- Name a pattern ("patternName") ONLY if at least two of the user's rejections genuinely support it (e.g. several no-responses at the application stage, or several interview-stage losses). If the data doesn't support a real pattern yet, return an EMPTY patternName — do not fabricate one.
- Protect the user's locus of control: focus on what THEY control (targeting, résumé match, where they apply, interview prep, referrals). Never imply the rejection is a verdict on their worth.
- "sharperNextApplication": 2–4 specific, controllable steps. No platitudes ("stay positive"), no steps that depend on the employer.
- "reframe": one or two honest sentences. Acknowledge the difficulty truthfully, then point forward. Never deny that it's hard; never over-promise.

Return strictly the requested fields.`;

const insightSchema = z.object({
  patternName: z.string(),
  patternEvidence: z.string(),
  sharperNextApplication: z.array(z.string()),
  reframe: z.string(),
});

/** Compact, model-friendly context: this rejection, the reflection, and the history. */
export function buildAutopsyContext(params: {
  application: AutopsyApplication;
  reflection: RejectionReflection;
  priorRejections: AutopsyApplication[];
}): string {
  const { application, reflection, priorRejections } = params;
  const lines: string[] = [];

  lines.push(`This rejection: "${application.title}" at ${application.company}.`);
  const stage = reflection.stage || application.rejectionStage || "";
  if (stage) lines.push(`Stage reached: ${STAGE_LABEL[stage] ?? stage}.`);
  if (application.jobDescription) {
    lines.push(`Job description (excerpt): ${application.jobDescription.slice(0, 1200)}`);
  }

  if (reflection.feedback?.trim()) lines.push(`Feedback they got: ${reflection.feedback.trim()}`);
  if (reflection.lesson?.trim()) lines.push(`Their own read on it: ${reflection.lesson.trim()}`);
  if (reflection.nextAction?.trim()) lines.push(`What they think is next: ${reflection.nextAction.trim()}`);

  if (priorRejections.length > 0) {
    lines.push("");
    lines.push(`Their other ${priorRejections.length} rejection(s), for pattern context:`);
    for (const r of priorRejections.slice(0, 12)) {
      const s = r.rejectionStage ? STAGE_LABEL[r.rejectionStage] ?? r.rejectionStage : "stage unknown";
      lines.push(`- "${r.title}" at ${r.company} — ${s}`);
    }
  } else {
    lines.push("");
    lines.push("This is the only rejection on file, so there isn't enough history for a cross-rejection pattern yet.");
  }

  return lines.join("\n");
}

/** Tally every known rejection stage (current + prior), most-common first. */
function stageCounts(currentStage: string | null | undefined, prior: AutopsyApplication[]): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (s: string | null | undefined) => {
    if (!s) return;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  };
  add(currentStage);
  for (const r of prior) add(r.rejectionStage);
  return counts;
}

/**
 * Deterministic pattern detection — the honest floor when there's no AI provider
 * (and the test anchor). Only claims a pattern when a single stage accounts for
 * ≥2 rejections; otherwise returns null rather than inventing one.
 */
export function heuristicPattern(
  currentStage: string | null | undefined,
  priorRejections: AutopsyApplication[],
): RejectionPattern | null {
  const counts = stageCounts(currentStage, priorRejections);
  let topStage = "";
  let topCount = 0;
  for (const [stage, n] of counts) {
    if (n > topCount) {
      topStage = stage;
      topCount = n;
    }
  }
  if (topCount < 2) return null;

  const evidence = `${topCount} of your rejections landed at the ${STAGE_LABEL[topStage] ?? topStage} stage — that consistency points at something specific and fixable, not at your ability.`;
  switch (topStage) {
    case "keyword":
      return { name: "You're being filtered before a human reads you", evidence };
    case "screen":
      return { name: "It's stalling at the early screen", evidence };
    case "interview":
      return { name: "You're reaching interviews but not converting them", evidence };
    case "final":
      return { name: "You're getting agonizingly close — final rounds", evidence };
    default:
      return { name: "A repeating stage in your rejections", evidence };
  }
}

/** Honest, controllable next-steps for a given dominant stage. */
function stepsForStage(stage: string): string[] {
  switch (stage) {
    case "keyword":
      return [
        "Mirror the exact job-title and 5–8 hard-skill keywords from the posting in your résumé — most no-responses are a keyword/format mismatch, not your background.",
        "Apply within 48 hours of a posting going live, and prioritise roles where you meet ~70%+ of the must-haves.",
        "Find one person at the company to ask for a referral — it's an independent draw that routes around the screening software rejecting your cold applications, not another pass through the same filter.",
      ];
    case "screen":
      return [
        "Tighten your top-of-résumé summary to name the role and your most relevant proof in the first two lines.",
        "Prepare a 60-second 'why this role, why me' so the recruiter screen has a clear story.",
        "Ask for a referral or a warm intro so you arrive pre-vouched-for instead of cold.",
      ];
    case "interview":
      return [
        "Do a structured debrief: which 2–3 questions felt weakest, and draft a stronger STAR answer for each.",
        "Run one mock interview out loud (with Fadi or a friend) before the next one.",
        "Send a specific, well-aimed thank-you that addresses anything you'd want to clarify.",
      ];
    case "final":
      return [
        "You're clearly competitive — keep several finals in flight so no single 'no' carries all the weight.",
        "Ask each final-round contact for candid feedback; at this stage people are far more likely to give it.",
        "Sharpen the one differentiator that gets you to finals into a crisp, evidence-backed story.",
      ];
    default:
      return [
        "Target roles where you meet ~70%+ of the must-haves and tailor the résumé to each.",
        "Add one referral or warm intro to your next few applications.",
      ];
  }
}

/**
 * The no-AI fallback insight. Always leaves the user with a real pattern (when the
 * data supports one) or an honest "not enough data yet", concrete next steps, and a
 * grounded reframe — so the autopsy is never empty even without a provider.
 */
export function heuristicInsight(
  application: AutopsyApplication,
  reflection: RejectionReflection,
  priorRejections: AutopsyApplication[],
): RejectionInsight {
  const stage = reflection.stage || application.rejectionStage || "";
  const pattern = heuristicPattern(stage, priorRejections);
  const reframe = pattern
    ? "This is hard, and the repetition is the useful part: it's a fixable pattern, not a referendum on you. Change the one thing it points at and the odds move."
    : "One rejection isn't a pattern or a verdict — it's a single data point. Keep logging them and I'll be able to show you what's actually driving them.";

  return {
    pattern,
    sharperNextApplication: stepsForStage(stage),
    reframe,
  };
}

/** Normalise the model's flat output into a RejectionInsight. */
function mapInsight(raw: z.infer<typeof insightSchema>): RejectionInsight {
  const name = raw.patternName.trim();
  const steps = raw.sharperNextApplication.map((s) => s.trim()).filter(Boolean).slice(0, 4);
  return {
    pattern: name ? { name, evidence: raw.patternEvidence.trim() } : null,
    sharperNextApplication: steps,
    reframe: raw.reframe.trim(),
  };
}

/**
 * Analyse a rejection into a pattern + sharper next application. Uses the user's
 * own AI provider when configured, and always falls back to the deterministic
 * heuristic so the autopsy never comes back empty. Never throws.
 */
export async function analyzeRejection(params: {
  userId: string;
  application: AutopsyApplication;
  reflection: RejectionReflection;
  priorRejections: AutopsyApplication[];
}): Promise<RejectionInsight> {
  const { userId, application, reflection, priorRejections } = params;
  try {
    const { getUserDocGenerate } = await import("@/lib/ai/user-generate");
    const generate = await getUserDocGenerate(userId);
    if (!generate) return heuristicInsight(application, reflection, priorRejections);

    const context = buildAutopsyContext({ application, reflection, priorRejections });
    const raw = await generate.structured(SYSTEM, context, insightSchema, "rejection_autopsy");
    const insight = mapInsight(raw);

    // Never leave the user with no forward step — fall back if the model gave nothing.
    if (insight.sharperNextApplication.length === 0) {
      return heuristicInsight(application, reflection, priorRejections);
    }
    return insight;
  } catch {
    return heuristicInsight(application, reflection, priorRejections);
  }
}
