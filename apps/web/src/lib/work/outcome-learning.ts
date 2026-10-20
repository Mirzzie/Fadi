/**
 * LEARNING FROM OUTCOMES: what one result should change about what comes next.
 *
 * A finished practice interview and a rejection both used to end where they happened — a score on
 * a screen, a reflection in a ledger — and the next thing the person was told to do took no notice
 * of either. Each now proposes ONE practice task, placed on Today as an open suggestion the
 * person can take or drop. Nothing is stored about them as a preference; the task is the whole
 * consequence, and dropping it is the answer.
 *
 * Pure, so what gets proposed from which result is pinned by tests.
 */

export type PracticeProposal = { title: string; reason: string };

type Dimension = "structure" | "specificity" | "relevance" | "concision";

const DIMENSION_TASK: Record<Dimension, string> = {
  structure: "Practise giving answers a clear shape: situation, task, action, result",
  specificity: "Practise naming exactly what you did, with what, and what changed",
  relevance: "Practise answering the question that was asked before adding context",
  concision: "Practise keeping each answer to about two minutes",
};

/** Below this average (out of 5) a dimension is worth a task; above it, practice is working. */
const WEAK = 3.5;

export type ReviewedQuestion = {
  review?: { scores?: Record<string, number> | null; improvements?: string[] } | null;
};

/**
 * The weakest scored dimension across a session's reviewed answers, if it is weak enough to be
 * worth practising. A session with no scored answers proposes nothing — there is nothing to
 * learn from a session nobody answered.
 */
export function practiceFromInterview(
  role: string,
  questions: ReviewedQuestion[]
): PracticeProposal | null {
  const totals = new Map<Dimension, { sum: number; n: number }>();
  const improvements: string[] = [];
  for (const question of questions) {
    const scores = question.review?.scores;
    if (!scores) continue;
    for (const dimension of Object.keys(DIMENSION_TASK) as Dimension[]) {
      const value = Number(scores[dimension]);
      if (!Number.isFinite(value)) continue;
      const total = totals.get(dimension) ?? { sum: 0, n: 0 };
      totals.set(dimension, { sum: total.sum + value, n: total.n + 1 });
    }
    improvements.push(...(question.review?.improvements ?? []));
  }

  let weakest: { dimension: Dimension; average: number } | null = null;
  for (const [dimension, { sum, n }] of totals) {
    const average = sum / n;
    if (!weakest || average < weakest.average) weakest = { dimension, average };
  }
  if (!weakest || weakest.average >= WEAK) return null;

  const advice = improvements.find((line) => line.trim().length > 0)?.trim();
  return {
    title: DIMENSION_TASK[weakest.dimension],
    reason: `In your ${role} practice, ${weakest.dimension} averaged ${weakest.average.toFixed(1)} of 5.${advice ? ` The review said: ${advice}` : ""}`,
  };
}

export type RejectionOutcome = {
  title: string;
  company: string;
  stage?: string | null;
  /** What the person wrote they would do next — their words win over any rule. */
  nextAction?: string | null;
  /** The autopsy's first concrete suggestion, when it made one. */
  sharperNext?: string | null;
};

/** One task from a rejection: the person's own next step, else one matched to where it ended. */
export function practiceFromRejection(outcome: RejectionOutcome): PracticeProposal {
  const where = `${outcome.title} at ${outcome.company}`;
  const own = outcome.nextAction?.trim();
  if (own) return { title: own, reason: `Your next step after ${where}, in your words.` };

  const suggestion = outcome.sharperNext?.trim();
  if (suggestion)
    return { title: suggestion, reason: `What the rejection from ${where} suggests.` };

  switch (outcome.stage) {
    case "interview":
    case "final":
      return {
        title: `Run a practice interview for roles like ${outcome.title}`,
        reason: `${where} ended at the ${outcome.stage} stage, so the conversation is the part to practise.`,
      };
    case "keyword":
    case "screen":
      return {
        title: `Tighten your résumé for roles like ${outcome.title}`,
        reason: `${where} ended at the ${outcome.stage === "keyword" ? "keyword" : "screening"} stage, before anyone spoke to you.`,
      };
    default:
      return {
        title: `Note what you would change for the next role like ${outcome.title}`,
        reason: `${where} ended without saying where.`,
      };
  }
}
