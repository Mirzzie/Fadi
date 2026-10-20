import "server-only";

import { createPracticeGraderChecksRepository } from "@careeros/database";

import type { DocGenerate } from "@/lib/ai/doc-generate";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";
import { consumeRateLimit } from "@/lib/security/rate-limit";

import { CHURN_REVIEW_ASSETS, CUSTOMER_SUCCESS_PACK, churnBrief } from "./packs/customer-success";
import {
  reviewSubmission,
  rubricPrompt,
  rubricScoresSchema,
  type QualityCriterion,
} from "./rubric";
import {
  EVAL_SEED,
  EVAL_VERSION,
  evalCases,
  graderShortfall,
  runRubricEvalRepeated,
  type GradeFn,
  type RepeatedEvalReport,
} from "./rubric-eval";
import { churnCase } from "./sim/churn-case";

/**
 * IS THIS PERSON'S MODEL FIT TO MARK WRITTEN WORK? (rubric-eval, 19 Oct 2026)
 *
 * Fadi reviews writing with the person's own model, so the review is only as fair as that model.
 * Before relying on it, the model is run — through the exact review path a submission takes —
 * over answers whose fair verdict is known, three times. Fit only if every run gives no false
 * pass, no error, and credits at least 80% of the good answers. Run only when the person asks:
 * it spends their quota. The result is kept per model; a different model needs its own check.
 */

export const GRADER_REPEATS = 3;

export type GraderStatus =
  | { state: "no_model" }
  | { state: "unchecked"; model: string; requests: number }
  | { state: "fit"; model: string; checkedAt: Date }
  | { state: "unfit"; model: string; checkedAt: Date; reason: string; requests: number };

const label = (identity: { provider: string; model: string }) =>
  `${identity.model} (${identity.provider})`;

/** Requests the check sends at most: every eval case, every run. */
function requestCount(): number {
  return evalCases().length * GRADER_REPEATS;
}

export async function graderStatus(userId: string): Promise<GraderStatus> {
  const { getUserDocGenerate } = await import("@/lib/ai/user-generate");
  const identity = (await getUserDocGenerate(userId))?.identity;
  if (!identity) return { state: "no_model" };
  const latest = await createPracticeGraderChecksRepository(getDatabase()).latest(userId, {
    ...identity,
    evalVersion: EVAL_VERSION,
  });
  if (!latest) return { state: "unchecked", model: label(identity), requests: requestCount() };
  if (latest.releasable) {
    return { state: "fit", model: label(identity), checkedAt: latest.createdAt };
  }
  return {
    state: "unfit",
    model: label(identity),
    checkedAt: latest.createdAt,
    reason:
      graderShortfall(latest.report as unknown as RepeatedEvalReport) ??
      "It didn't pass the check.",
    requests: requestCount(),
  };
}

/** May this model's review count? Only when its latest check, on this evaluation set, passed. */
export async function isFitToMark(
  userId: string,
  identity: { provider: string; model: string } | undefined
): Promise<boolean> {
  if (!identity) return false;
  const latest = await createPracticeGraderChecksRepository(getDatabase()).latest(userId, {
    ...identity,
    evalVersion: EVAL_VERSION,
  });
  return Boolean(latest?.releasable);
}

/** The review path a real submission takes, as a grading function over the evaluation set. */
export function graderFor(generate: DocGenerate): GradeFn {
  const theCase = churnCase(EVAL_SEED);
  const brief = churnBrief(theCase);
  const steps = CUSTOMER_SUCCESS_PACK.activities[0]!.steps;
  return async ({ caseId, step, submission, choices }) => {
    const assets = CHURN_REVIEW_ASSETS[step]!;
    const fields = assets.choices?.(theCase) ?? [];
    const quality = assets.criteria.filter((k): k is QualityCriterion => k.kind === "quality");
    const prompt = rubricPrompt({
      brief,
      task: steps.find((s) => s.id === step)!.instruction,
      criteria: quality,
      submission,
      choices: fields.map((f) => ({ label: f.label, value: choices[f.id]! })),
    });
    // A failed review is retried once, as a person would by submitting again (a real attempt
    // whose review failed is reviewed again, not lost). gemma3:4b failed 1 of 45 once (20 Oct).
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const scores = await generate.structured(
          prompt.system,
          prompt.user,
          rubricScoresSchema,
          "rubric_review",
          { maxTokens: 1500 }
        );
        const review = reviewSubmission(
          assets.criteria,
          { text: submission, choices },
          theCase,
          scores
        );
        return {
          verdict: review.verdict,
          criteria: review.results.map((r) => ({
            id: r.id,
            level: r.level,
            decidedBy: r.decidedBy,
            feedback: r.feedback.slice(0, 300),
          })),
        };
      } catch (error) {
        logger.warn("practice.grader_check_review_failed", {
          caseId,
          attempt,
          error: error instanceof Error ? error.message.slice(0, 300) : "unknown",
        });
      }
    }
    return "error";
  };
}

/** A check is 45 calls on the person's own quota; a held-down button must not repeat it. */
const CHECKS_PER_DAY = 3;

export type CheckResult = { ok: true; status: GraderStatus } | { ok: false; message: string };

/** Measure the person's current model and keep the result. Only on their request. */
export async function checkGrader(userId: string): Promise<CheckResult> {
  const rate = await consumeRateLimit({
    key: `practice-grader-check:${userId}`,
    limit: CHECKS_PER_DAY,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return {
      ok: false,
      message: `You've checked ${CHECKS_PER_DAY} times today — each check spends about 45 requests of your AI allowance. Try again tomorrow, or switch model in Settings → AI.`,
    };
  }
  const { getUserDocGenerate } = await import("@/lib/ai/user-generate");
  const generate = await getUserDocGenerate(userId, { meteredByCaller: true });
  if (!generate?.identity) return { ok: true, status: { state: "no_model" } };
  const identity = generate.identity;
  const report = await runRubricEvalRepeated(graderFor(generate), GRADER_REPEATS);
  // A refused or failed call says nothing about whether the model marks fairly (a free tier's
  // per-minute limit, a server that went away), so it is not recorded as "unfit".
  const errored = report.runs.flatMap((run) => run.errors).length;
  if (errored) {
    logger.warn("practice.grader_check_incomplete", { userId, errored });
    return {
      ok: false,
      message: `Your model couldn't give a usable review for ${errored} of the test answers, even on a second try. Nothing was recorded — try again later, or choose another model in Settings.`,
    };
  }
  await createPracticeGraderChecksRepository(getDatabase()).record(userId, {
    ...identity,
    evalVersion: EVAL_VERSION,
    releasable: report.releasable,
    report: report as unknown as Record<string, unknown>,
  });
  logger.info("practice.grader_checked", {
    userId,
    provider: identity.provider,
    model: identity.model,
    releasable: report.releasable,
    runs: report.runs.length,
  });
  return { ok: true, status: await graderStatus(userId) };
}
