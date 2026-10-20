import "server-only";

import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

import {
  createCareerProfilesRepository,
  createLearningCommitmentsRepository,
  createPracticeReceiptsRepository,
  createPracticeSubmissionsRepository,
  createProjectRunsRepository,
  insertProjectRunWithSteps,
  projectRuns,
} from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";

import { activityRuntime, type ActivityRuntime } from "./packs";
import {
  composeAnswer,
  parseAnswer,
  reviewSubmission,
  rubricPrompt,
  rubricScoresSchema,
  validChoices,
  type ChoiceField,
  type CriterionResult,
  type QualityCriterion,
} from "./rubric";

/**
 * THE DOCUMENT WORK SIMULATION, end to end through the existing kernel (Gate 3, ADR 0014):
 *
 *   commitment → project run (steps from the pack, not the AI planner) → the person writes →
 *   immutable attempt → rubric review → `observed` receipt → step done → existing finish review →
 *   career evidence only if the person says it's accurate.
 *
 * No parallel planner, completion flow, activity log or approval store. Server-only: every
 * function takes the caller's own user id; the "use server" actions check the session first.
 */

export type StartResult = { ok: true; runId: string } | { ok: false; message: string };

export async function startPracticeActivity(
  userId: string,
  input: { packId: string; activityId: string }
): Promise<StartResult> {
  const runtime = activityRuntime(input.packId, input.activityId);
  if (!runtime) return { ok: false, message: "That activity isn't installed." };
  const db = getDatabase();
  const { pack, activity } = runtime;
  const track = await createCareerProfilesRepository(db).getActiveForUser(userId);
  const run = await db.transaction(async (tx) => {
    // A missing row cannot be locked. Serialize the start decision by activity and owner so two
    // tabs cannot both observe "none" and create duplicate commitments and runs.
    const lockKey = `practice:${userId}:${pack.id}:${activity.id}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
    const [existing] = await tx
      .select()
      .from(projectRuns)
      .where(
        and(
          eq(projectRuns.userId, userId),
          eq(projectRuns.status, "running"),
          sql`${projectRuns.practice}->>'packId' = ${pack.id}`,
          sql`${projectRuns.practice}->>'activityId' = ${activity.id}`
        )
      )
      .limit(1);
    if (existing) return existing;

    const commitment = await createLearningCommitmentsRepository(tx).createForUser(userId, {
      careerProfileId: track?.id ?? null,
      gap: activity.competencies[0] ?? pack.domain.label,
      title: activity.title,
      detail: activity.outcome,
      kind: "project",
      searchQuery: null,
    });
    return newRun(tx, userId, runtime, {
      commitmentId: commitment.id,
      careerProfileId: track?.id ?? null,
    });
  });
  logger.info("practice.activity_started", { userId, packId: pack.id, activityId: activity.id });
  return { ok: true, runId: run.id };
}

type Tx = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];

/** A run of the activity with a fresh case: a strong per-run seed, never chosen by a model. */
async function newRun(
  tx: Tx,
  userId: string,
  runtime: ActivityRuntime,
  owner: { commitmentId: string | null; careerProfileId: string | null }
) {
  const { pack, activity } = runtime;
  const seed = randomBytes(16).toString("hex");
  const created = await insertProjectRunWithSteps(
    tx,
    userId,
    {
      title: activity.title,
      detail: `${activity.outcome}\n\n${runtime.brief(seed)}`,
      commitmentId: owner.commitmentId,
      careerProfileId: owner.careerProfileId,
      practice: { packId: pack.id, packVersion: pack.version, activityId: activity.id, seed },
    },
    activity.steps.map((step, index) => ({
      ordinal: index + 1,
      title: step.title,
      instruction: step.instruction,
      verify: "Fadi reviews what you write against the criteria for this step.",
      produces: "Your written answer",
      place: "document",
      checkCommand: null,
      checkExpect: null,
    }))
  );
  return created.run;
}

/**
 * START OVER WITH A NEW CASE (Codex P1, 18 Oct 2026): the running attempt is closed as abandoned —
 * its submissions and receipts stay, unchanged, on its record — and a new run of the same
 * activity starts with new figures, under the same commitment. Nothing is deleted.
 */
export async function restartPracticeActivity(
  userId: string,
  input: { runId: string }
): Promise<StartResult> {
  const db = getDatabase();
  const project = await createProjectRunsRepository(db).getWithSteps(userId, input.runId);
  const practice = project?.run.practice;
  if (!project || !practice || project.run.status !== "running") {
    return { ok: false, message: "Only a work simulation in progress can be started over." };
  }
  const runtime = activityRuntime(practice.packId, practice.activityId);
  if (!runtime) return { ok: false, message: "That activity isn't installed any more." };
  const run = await db.transaction(async (tx) => {
    // The same lock as a start, so a restart and a start can't both create a run.
    const lockKey = `practice:${userId}:${practice.packId}:${practice.activityId}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
    const closed = await tx
      .update(projectRuns)
      .set({ status: "abandoned" })
      .where(
        and(
          eq(projectRuns.id, input.runId),
          eq(projectRuns.userId, userId),
          eq(projectRuns.status, "running")
        )
      )
      .returning({ id: projectRuns.id });
    if (!closed.length) return null;
    return newRun(tx, userId, runtime, {
      commitmentId: project.run.commitmentId,
      careerProfileId: project.run.careerProfileId,
    });
  });
  if (!run) return { ok: false, message: "That simulation was already closed." };
  logger.info("practice.activity_restarted", { userId, from: input.runId, to: run.id });
  return { ok: true, runId: run.id };
}

type RunContext = {
  runtime: ActivityRuntime;
  seed: string;
  packStepId: string;
  brief: string;
  task: string;
  /** Hints opened on this step so far. */
  hintsRevealed: number;
};

async function contextFor(
  userId: string,
  runId: string,
  stepId: string
): Promise<RunContext | null> {
  const project = await createProjectRunsRepository(getDatabase()).getWithSteps(userId, runId);
  const practice = project?.run.practice;
  const step = project?.steps.find((s) => s.id === stepId);
  const current = project?.steps.find((candidate) => candidate.status === "pending");
  if (
    !project ||
    project.run.status !== "running" ||
    !practice ||
    !step ||
    current?.id !== step.id
  ) {
    return null;
  }
  const runtime = activityRuntime(practice.packId, practice.activityId, practice.packVersion);
  const packStep = runtime?.activity.steps[step.ordinal - 1];
  if (!runtime || !packStep) return null;
  return {
    runtime,
    seed: practice.seed,
    packStepId: packStep.id,
    brief: runtime.brief(practice.seed),
    task: packStep.instruction,
    hintsRevealed: step.hintsRevealed,
  };
}

/**
 * Why a step can't be handed in, in the person's terms. A run made with an earlier version of the
 * activity can't be reviewed by this one (its criteria changed); starting over gives a new case
 * under the same commitment. (The owner had a 0.1.0 run open when 0.2.0 landed, 20 Oct 2026.)
 */
async function whyNoContext(userId: string, runId: string): Promise<string> {
  const project = await createProjectRunsRepository(getDatabase()).getWithSteps(userId, runId);
  const practice = project?.run.practice;
  if (
    practice &&
    project.run.status === "running" &&
    !activityRuntime(practice.packId, practice.activityId, practice.packVersion) &&
    activityRuntime(practice.packId, practice.activityId)
  ) {
    return "This simulation was made with an earlier version of the activity, and its review has changed since. Open All steps → Start the project over for a new case.";
  }
  return "That step isn't part of a work simulation.";
}

/** The decisions this step asks for, from the run's own case. */
function choiceFields(context: RunContext): ChoiceField[] {
  const assets = context.runtime.assets[context.packStepId];
  return assets?.choices?.(context.runtime.caseFor(context.seed)) ?? [];
}

export type ReviewView = {
  verdict: "pass" | "fail";
  met: number;
  total: number;
  attempt: number;
  results: CriterionResult[];
  /** Only after the person's own work passed. */
  exampleAnswer: string | null;
  receiptId: string;
};

export type SubmitResult =
  | { ok: true; review: ReviewView }
  /** `graderCheck`: the person's model hasn't passed the marking check — offer it in place. */
  | { ok: false; message: string; graderCheck?: true };

export async function submitForReview(
  userId: string,
  input: { runId: string; stepId: string; body: string; choices?: Record<string, string> }
): Promise<SubmitResult> {
  const context = await contextFor(userId, input.runId, input.stepId);
  if (!context) return { ok: false, message: await whyNoContext(userId, input.runId) };
  const assets = context.runtime.assets[context.packStepId];
  if (!assets) return { ok: false, message: "This step has no review criteria." };

  const fields = choiceFields(context);
  const choices = validChoices(fields, input.choices);
  if (fields.some((field) => !choices[field.id])) {
    return { ok: false, message: "Make every choice above your answer before submitting." };
  }

  const db = getDatabase();
  const submissions = createPracticeSubmissionsRepository(db);
  const receipts = createPracticeReceiptsRepository(db);
  const body = composeAnswer(fields, { text: input.body, choices });
  const latest = await submissions.latestForStep(userId, input.stepId);
  const latestReceipt = latest
    ? (await receipts.listForStep(userId, input.stepId)).find(
        (receipt) =>
          receipt.sourceKind === "practice_submission" && receipt.sourceRefId === latest.id
      )
    : null;
  if (latest?.body === body && latestReceipt) {
    return {
      ok: false,
      message:
        "This exact attempt was already reviewed. Reload the page to see its recorded result before revising.",
    };
  }

  const { getUserDocGenerate } = await import("@/lib/ai/user-generate");
  const generate = await getUserDocGenerate(userId);
  if (!generate) {
    return {
      ok: false,
      message:
        "Fadi needs an AI provider to review your work — add one in Settings → AI. Nothing was submitted.",
    };
  }

  // Writing is reviewed only by a model that has shown it marks fairly (rubric-eval). Checked
  // before anything is kept, so an unchecked model costs the person no attempt.
  const needsModel = assets.criteria.some((c) => c.kind === "quality");
  if (needsModel) {
    const { isFitToMark } = await import("./grader-check");
    if (!(await isFitToMark(userId, generate.identity))) {
      return {
        ok: false,
        graderCheck: true,
        message:
          "Before Fadi reviews your writing, your AI model needs to pass its marking check. Nothing was submitted.",
      };
    }
  }

  // A provider failure leaves an immutable, unreviewed attempt. Retrying unchanged work reviews
  // that same attempt instead of inflating the attempt count; changed work intentionally creates
  // a new attempt.
  // A hint opened since that attempt makes the next one a new attempt, so the record is honest.
  const submission =
    latest?.body === body && !latestReceipt && latest.hintsUsed === context.hintsRevealed
      ? latest
      : await submissions.submit(userId, { runId: input.runId, stepId: input.stepId, body });
  if (!submission) {
    return { ok: false, message: "That step is closed, or the text is empty or too long." };
  }

  // Read back from the stored attempt, so a retry reviews exactly what was kept.
  const answer = parseAnswer(fields, submission.body);
  const quality = assets.criteria.filter((c): c is QualityCriterion => c.kind === "quality");
  let scores = null;
  if (quality.length) {
    try {
      const prompt = rubricPrompt({
        brief: context.brief,
        task: context.task,
        criteria: quality,
        submission: answer.text,
        choices: fields.map((field) => ({ label: field.label, value: answer.choices[field.id]! })),
      });
      scores = await generate.structured(
        prompt.system,
        prompt.user,
        rubricScoresSchema,
        "rubric_review",
        { maxTokens: 1500 }
      );
    } catch (error) {
      logger.warn("practice.review_model_failed", {
        userId,
        error: error instanceof Error ? error.message : "unknown",
      });
      return {
        ok: false,
        message: `Your attempt ${submission.attempt} is saved, but Fadi couldn't review it right now. Submit again in a moment.`,
      };
    }
  }

  const theCase = context.runtime.caseFor(context.seed);
  const review = reviewSubmission(assets.criteria, answer, theCase, scores);
  const lines = review.results.map(
    (r) =>
      `${r.level === "not_yet" ? "✗" : "✓"} ${r.label} (${r.level.replace("_", " ")}): ${r.feedback}`
  );
  const { receipt } = await receipts.recordRubricReview(userId, {
    submissionId: submission.id,
    assessmentId: "fadi.rubric",
    assessmentVersion: "1",
    verdict: review.verdict,
    met: review.met,
    total: review.total,
    evidence: {
      seen: `${review.met} of ${review.total} criteria met on attempt ${submission.attempt}, ${submission.hintsUsed ? `with ${submission.hintsUsed} hint(s)` : "unaided"}.`,
      excerpt: lines.join("\n").slice(0, 3_900),
      outputs: [{ kind: "text", ref: `practice_submission:${submission.id}` }],
    },
  });

  return {
    ok: true,
    review: {
      verdict: review.verdict,
      met: review.met,
      total: review.total,
      attempt: submission.attempt,
      results: review.results,
      exampleAnswer: review.verdict === "pass" ? assets.exampleAnswer(theCase) : null,
      receiptId: receipt.id,
    },
  };
}

export type DocumentStepState = {
  draft: string | null;
  /** The last attempt's picks, and the decisions this step asks for. */
  draftChoices: Record<string, string>;
  choices: ChoiceField[];
  /** Hints opened so far, in order, and how many the step has in all. */
  hints: string[];
  hintsAvailable: number;
  attempt: number;
  lastReview: { verdict: string; seen: string; lines: string[] } | null;
};

/** What the step shows on load: the last attempt's text and its review, if any. */
export async function documentStepState(
  userId: string,
  input: { runId: string; stepId: string }
): Promise<DocumentStepState | null> {
  const context = await contextFor(userId, input.runId, input.stepId);
  if (!context) return null;
  const db = getDatabase();
  const fields = choiceFields(context);
  const allHints = context.runtime.assets[context.packStepId]?.hints ?? [];
  const base = {
    choices: fields,
    hints: allHints.slice(0, context.hintsRevealed),
    hintsAvailable: allHints.length,
  };
  const last = await createPracticeSubmissionsRepository(db).latestForStep(userId, input.stepId);
  if (!last) return { ...base, draft: null, draftChoices: {}, attempt: 0, lastReview: null };
  const receipts = await createPracticeReceiptsRepository(db).listForStep(userId, input.stepId);
  const receipt = receipts.find((r) => r.sourceRefId === last.id) ?? null;
  const answer = parseAnswer(fields, last.body);
  return {
    ...base,
    draft: answer.text,
    draftChoices: answer.choices,
    attempt: last.attempt,
    lastReview: receipt
      ? {
          verdict: receipt.verdict,
          seen: receipt.evidence.seen,
          lines: (receipt.evidence.excerpt ?? "").split("\n").filter(Boolean),
        }
      : null,
  };
}

/**
 * Open the next hint on the current step. Recorded on the step first, then shown: every later
 * attempt says "with N hints". Returns the hints now open.
 */
export async function revealHint(
  userId: string,
  input: { runId: string; stepId: string }
): Promise<{ ok: true; hints: string[] } | { ok: false; message: string }> {
  const context = await contextFor(userId, input.runId, input.stepId);
  const all = context ? (context.runtime.assets[context.packStepId]?.hints ?? []) : [];
  if (!context || !all.length) return { ok: false, message: "This step has no hints." };
  const opened = await createPracticeSubmissionsRepository(getDatabase()).revealHint(userId, {
    ...input,
    available: all.length,
  });
  if (opened === null) return { ok: false, message: "That step is closed." };
  return { ok: true, hints: all.slice(0, opened) };
}
