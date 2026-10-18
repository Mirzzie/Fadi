import "server-only";

import { randomBytes } from "node:crypto";

import {
  createCareerProfilesRepository,
  createLearningCommitmentsRepository,
  createPracticeReceiptsRepository,
  createPracticeSubmissionsRepository,
  createProjectRunsRepository,
} from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";

import { activityRuntime, type ActivityRuntime } from "./packs";
import {
  reviewSubmission,
  rubricPrompt,
  rubricScoresSchema,
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
  const runs = createProjectRunsRepository(db);

  // One run of an activity at a time: Continue it rather than starting a second copy.
  const existing = (await runs.listForUser(userId)).find(
    (run) =>
      run.practice?.packId === input.packId &&
      run.practice.activityId === input.activityId &&
      run.status === "running"
  );
  if (existing) return { ok: true, runId: existing.id };

  const { pack, activity } = runtime;
  const track = await createCareerProfilesRepository(db).getActiveForUser(userId);
  const commitment = await createLearningCommitmentsRepository(db).createForUser(userId, {
    careerProfileId: track?.id ?? null,
    gap: activity.competencies[0] ?? pack.domain.label,
    title: activity.title,
    detail: activity.outcome,
    kind: "project",
    searchQuery: null,
  });
  // A strong per-run seed: the case is regenerated from it, never chosen by a model.
  const seed = randomBytes(16).toString("hex");
  const { run } = await runs.createWithSteps(
    userId,
    {
      title: activity.title,
      detail: `${activity.outcome}\n\n${runtime.brief(seed)}`,
      commitmentId: commitment.id,
      careerProfileId: track?.id ?? null,
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
  logger.info("practice.activity_started", { userId, packId: pack.id, activityId: activity.id });
  return { ok: true, runId: run.id };
}

type RunContext = {
  runtime: ActivityRuntime;
  seed: string;
  packStepId: string;
  brief: string;
  task: string;
};

async function contextFor(
  userId: string,
  runId: string,
  stepId: string
): Promise<RunContext | null> {
  const project = await createProjectRunsRepository(getDatabase()).getWithSteps(userId, runId);
  const practice = project?.run.practice;
  const step = project?.steps.find((s) => s.id === stepId);
  if (!project || !practice || !step) return null;
  const runtime = activityRuntime(practice.packId, practice.activityId, practice.packVersion);
  const packStep = runtime?.activity.steps[step.ordinal - 1];
  if (!runtime || !packStep) return null;
  return {
    runtime,
    seed: practice.seed,
    packStepId: packStep.id,
    brief: runtime.brief(practice.seed),
    task: packStep.instruction,
  };
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

export type SubmitResult = { ok: true; review: ReviewView } | { ok: false; message: string };

export async function submitForReview(
  userId: string,
  input: { runId: string; stepId: string; body: string; hintsUsed?: number }
): Promise<SubmitResult> {
  const context = await contextFor(userId, input.runId, input.stepId);
  if (!context) return { ok: false, message: "That step isn't part of a work simulation." };
  const assets = context.runtime.assets[context.packStepId];
  if (!assets) return { ok: false, message: "This step has no review criteria." };

  const { getUserDocGenerate } = await import("@/lib/ai/user-generate");
  const generate = await getUserDocGenerate(userId);
  if (!generate) {
    return {
      ok: false,
      message:
        "Fadi needs an AI provider to review your work — add one in Settings → AI. Nothing was submitted.",
    };
  }

  const db = getDatabase();
  const submission = await createPracticeSubmissionsRepository(db).submit(userId, input);
  if (!submission) {
    return { ok: false, message: "That step is closed, or the text is empty or too long." };
  }

  const quality = assets.criteria.filter((c): c is QualityCriterion => c.kind === "quality");
  let scores = null;
  if (quality.length) {
    try {
      const prompt = rubricPrompt({
        brief: context.brief,
        task: context.task,
        criteria: quality,
        submission: submission.body,
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
  const review = reviewSubmission(assets.criteria, submission.body, theCase, scores);
  const lines = review.results.map(
    (r) =>
      `${r.level === "not_yet" ? "✗" : "✓"} ${r.label} (${r.level.replace("_", " ")}): ${r.feedback}`
  );
  const { receipt } = await createPracticeReceiptsRepository(db).recordRubricReview(userId, {
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
  const last = await createPracticeSubmissionsRepository(db).latestForStep(userId, input.stepId);
  if (!last) return { draft: null, attempt: 0, lastReview: null };
  const receipts = await createPracticeReceiptsRepository(db).listForStep(userId, input.stepId);
  const receipt = receipts.find((r) => r.sourceRefId === last.id) ?? null;
  return {
    draft: last.body,
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
