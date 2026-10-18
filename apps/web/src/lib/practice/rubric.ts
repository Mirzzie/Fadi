import { z } from "zod";

/**
 * THE RUBRIC ASSESSMENT ADAPTER (fadi.rubric v1) — the pure half.
 *
 * A document step is reviewed against named criteria. Two kinds:
 * - FACT criteria are decided in code from the run's own case (which accounts are really at risk,
 *   which one is a decoy). A model never decides a fact, and a copied answer from someone else's
 *   case fails them.
 * - QUALITY criteria are judged by a model, but only count when the model QUOTES the person's own
 *   text as the place it is shown. A "meets" with a quote that isn't in the submission is turned
 *   back into "not yet": Fadi doesn't praise what it can't point to.
 *
 * The result is OBSERVED evidence, never verified (Codex, 17 Oct 2026): a model scored it, and the
 * person can accept or challenge it. It passes only when every criterion at least meets the bar.
 */

export type Level = "not_yet" | "meets" | "strong";

export type QualityCriterion = {
  id: string;
  kind: "quality";
  label: string;
  /** What "meets" looks like, for the model and for the person. */
  meets: string;
  /** What "strong" adds. */
  strong: string;
};

export type FactCriterion<Case> = {
  id: string;
  kind: "fact";
  label: string;
  /** Decided in code. `seen` says what was found, in the person's language. */
  check: (submission: string, theCase: Case) => { met: boolean; seen: string };
};

export type Criterion<Case> = QualityCriterion | FactCriterion<Case>;

export type CriterionResult = {
  id: string;
  label: string;
  level: Level;
  /** One or two sentences: what's there, and what would raise it. */
  feedback: string;
  /** The person's own words the judgement rests on (quality criteria). */
  quote: string | null;
  decidedBy: "code" | "model";
};

export type RubricReview = {
  verdict: "pass" | "fail";
  results: CriterionResult[];
  met: number;
  total: number;
};

/** What the model returns. Every property required, nullable not optional (strict mode). */
export const rubricScoresSchema = z.object({
  criteria: z
    .array(
      z.object({
        id: z.string().max(80),
        level: z.enum(["not_yet", "meets", "strong"]),
        quote: z.string().max(600).nullable(),
        feedback: z.string().max(600),
      })
    )
    .max(20),
});

export type RubricScores = z.infer<typeof rubricScoresSchema>;

const normalise = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();

/** A quote counts only if it is really in the submission, and long enough to mean something. */
export function quoteIsGenuine(quote: string | null, submission: string): boolean {
  if (!quote) return false;
  const q = normalise(quote.replace(/^["“”']+|["“”']+$/g, ""));
  return q.length >= 12 && normalise(submission).includes(q);
}

export function reviewSubmission<Case>(
  criteria: Criterion<Case>[],
  submission: string,
  theCase: Case,
  scores: RubricScores | null
): RubricReview {
  const results = criteria.map((criterion): CriterionResult => {
    if (criterion.kind === "fact") {
      const { met, seen } = criterion.check(submission, theCase);
      return {
        id: criterion.id,
        label: criterion.label,
        level: met ? "meets" : "not_yet",
        feedback: seen,
        quote: null,
        decidedBy: "code",
      };
    }
    const score = scores?.criteria.find((s) => s.id === criterion.id);
    if (!score) {
      return {
        id: criterion.id,
        label: criterion.label,
        level: "not_yet",
        feedback: "Fadi couldn't judge this one. Submit again in a moment.",
        quote: null,
        decidedBy: "model",
      };
    }
    // Praise needs a place in the person's own text.
    if (score.level !== "not_yet" && !quoteIsGenuine(score.quote, submission)) {
      return {
        id: criterion.id,
        label: criterion.label,
        level: "not_yet",
        feedback: `Fadi couldn't point to where your text shows this. ${criterion.meets}`,
        quote: null,
        decidedBy: "model",
      };
    }
    return {
      id: criterion.id,
      label: criterion.label,
      level: score.level,
      feedback: score.feedback.trim(),
      quote: score.level === "not_yet" ? null : score.quote,
      decidedBy: "model",
    };
  });
  const met = results.filter((r) => r.level !== "not_yet").length;
  return { verdict: met === results.length ? "pass" : "fail", results, met, total: results.length };
}

/** The instructions the model scores with. It never sees the expected facts or a model answer. */
export function rubricPrompt(input: {
  brief: string;
  task: string;
  criteria: QualityCriterion[];
  submission: string;
}): { system: string; user: string } {
  return {
    system: [
      "You review one piece of work against named criteria, as a demanding but fair senior colleague.",
      "For each criterion give a level: not_yet, meets or strong.",
      "For meets or strong you MUST copy a short exact quote (12+ characters) from the submission that shows it. If no part of the submission shows it, the level is not_yet and quote is null.",
      "Feedback: one or two plain sentences — what is there, and the single most useful thing that would raise it. Never write the answer for them.",
      "Judge only what is written. Do not reward length, confidence or buzzwords.",
    ].join("\n"),
    user: [
      `THE BRIEF\n${input.brief}`,
      `THE TASK\n${input.task}`,
      "CRITERIA",
      ...input.criteria.map(
        (c) => `- id: ${c.id}\n  ${c.label}\n  meets: ${c.meets}\n  strong: ${c.strong}`
      ),
      `THE SUBMISSION\n"""\n${input.submission}\n"""`,
    ].join("\n\n"),
  };
}
