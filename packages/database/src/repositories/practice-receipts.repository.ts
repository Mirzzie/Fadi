import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../client";
import {
  labActionRequests,
  practiceReceipts,
  practiceSubmissions,
  projectRuns,
  projectSteps,
  type PracticeReceipt,
  type ProjectStep,
} from "../schema/index";
import { settleProjectWork, settleRun } from "./project-runs.repository";

export type ReceiptEvidence = {
  seen: string;
  excerpt?: string;
  outputs?: Array<{ kind: string; ref: string }>;
};

export type CompleteMachineCheckInput = {
  requestId: string;
  runId: string;
  stepId: string;
  verdict: "pass" | "fail" | "unknown";
  detail: string;
  output: string;
  artifact: string;
  evidence: ReceiptEvidence;
  observedAt?: Date;
};

function checkedEvidence(input: ReceiptEvidence): ReceiptEvidence {
  const seen = input.seen.trim();
  if (!seen || seen.length > 400) throw new Error("Receipt summary is invalid.");
  const excerpt = input.excerpt?.trim();
  if (excerpt && excerpt.length > 4_000) throw new Error("Receipt excerpt is too long.");
  const outputs = input.outputs ?? [];
  if (outputs.length > 12) throw new Error("Receipt has too many outputs.");
  for (const output of outputs) {
    if (
      !output.kind.trim() ||
      output.kind.length > 80 ||
      !output.ref.trim() ||
      output.ref.length > 2_000
    ) {
      throw new Error("Receipt output reference is invalid.");
    }
  }
  const evidence = {
    seen,
    ...(excerpt ? { excerpt } : {}),
    ...(outputs.length ? { outputs } : {}),
  };
  if (JSON.stringify(evidence).length > 8_000) throw new Error("Receipt evidence is too large.");
  return evidence;
}

/**
 * Immutable Practice receipts.
 *
 * `completeMachineCheck` is intentionally narrower than a general insert. It verifies the source
 * approval belongs to the same person, run and step, then finishes the source request, records the
 * receipt and (on pass) completes the step in one transaction. A model cannot manufacture a
 * `verified` receipt by calling a generic repository method.
 */
export function createPracticeReceiptsRepository(db: Database) {
  return {
    async completeMachineCheck(
      userId: string,
      input: CompleteMachineCheckInput
    ): Promise<{ receipt: PracticeReceipt; step: ProjectStep }> {
      const evidence = checkedEvidence(input.evidence);
      if (input.detail.length > 400) throw new Error("Check detail is too long.");
      if (input.output.length > 8_000) throw new Error("Check output is too long.");
      if (input.artifact.length > 1_000) throw new Error("Step result is too long.");

      return db.transaction(async (tx) => {
        const [request] = await tx
          .select({
            id: labActionRequests.id,
            status: labActionRequests.status,
            recipe: labActionRequests.recipe,
            runId: labActionRequests.runId,
            stepId: labActionRequests.stepId,
          })
          .from(labActionRequests)
          .where(
            and(eq(labActionRequests.id, input.requestId), eq(labActionRequests.userId, userId))
          )
          .for("update")
          .limit(1);
        if (!request) throw new Error("Check request is unavailable.");
        if (
          request.recipe !== "lab.check" ||
          request.runId !== input.runId ||
          request.stepId !== input.stepId
        ) {
          throw new Error("Check request does not belong to this step.");
        }

        const [existing] = await tx
          .select()
          .from(practiceReceipts)
          .where(
            and(
              eq(practiceReceipts.userId, userId),
              eq(practiceReceipts.sourceKind, "lab_action_request"),
              eq(practiceReceipts.sourceRefId, input.requestId)
            )
          )
          .limit(1);
        if (existing) {
          const [step] = await tx
            .select()
            .from(projectSteps)
            .innerJoin(projectRuns, eq(projectRuns.id, projectSteps.runId))
            .where(
              and(
                eq(projectSteps.id, input.stepId),
                eq(projectRuns.id, input.runId),
                eq(projectRuns.userId, userId)
              )
            )
            .then((rows) => rows.map((row) => row.project_steps));
          if (!step) throw new Error("Practice step is unavailable.");
          return { receipt: existing, step };
        }
        if (request.status !== "approved") throw new Error("Check request is not approved.");

        const [row] = await tx
          .select({
            run: projectRuns,
            step: projectSteps,
          })
          .from(projectSteps)
          .innerJoin(projectRuns, eq(projectRuns.id, projectSteps.runId))
          .where(
            and(
              eq(projectSteps.id, input.stepId),
              eq(projectRuns.id, input.runId),
              eq(projectRuns.userId, userId)
            )
          )
          .for("update")
          .limit(1);
        if (!row) throw new Error("Practice step is unavailable.");

        const observedAt = input.observedAt ?? new Date();
        await tx
          .update(labActionRequests)
          .set({
            status: "executed",
            detail: input.detail,
            output: input.output,
            executedAt: observedAt,
            updatedAt: observedAt,
          })
          .where(
            and(
              eq(labActionRequests.id, input.requestId),
              eq(labActionRequests.userId, userId),
              eq(labActionRequests.status, "approved")
            )
          );

        let step = row.step;
        if (input.verdict === "pass") {
          [step] = await tx
            .update(projectSteps)
            .set({
              status: "done",
              completion: "verified",
              artifact: input.artifact,
              completedAt: observedAt,
              updatedAt: observedAt,
            })
            .where(eq(projectSteps.id, input.stepId))
            .returning();
        }

        const [receipt] = await tx
          .insert(practiceReceipts)
          .values({
            userId,
            runId: row.run.id,
            stepId: row.step.id,
            runLabel: row.run.title,
            stepLabel: row.step.title,
            assessmentKind: "machine_predicate",
            assessmentId: "lab.check",
            assessmentVersion: "1",
            verdict: input.verdict,
            strength: input.verdict === "unknown" ? "observed" : "verified",
            sourceKind: "lab_action_request",
            sourceRefId: input.requestId,
            observerId: "fadi.lab-broker",
            observerVersion: "1",
            evidence,
            observedAt,
          })
          .returning();

        if (input.verdict === "pass") {
          await settleRun(tx, row.run.id, row.run.status);
          const [settled] = await tx
            .select({ status: projectRuns.status })
            .from(projectRuns)
            .where(eq(projectRuns.id, row.run.id))
            .limit(1);
          if (settled) await settleProjectWork(tx, userId, row.run.id, settled.status);
        }
        return { receipt, step };
      });
    },

    /**
     * Record Fadi's rubric review of one submitted attempt. As narrow as `completeMachineCheck`:
     * the source is the person's own submission (owner, run and step checked under lock), one
     * attempt yields at most one receipt, and the strength is ALWAYS `observed` — a model scored
     * it, so it can never claim `verified` (Codex, 17 Oct 2026). On pass, the step completes as
     * `evidenced` (a recorded result, reviewed), in the same transaction, and the run settles.
     */
    async recordRubricReview(
      userId: string,
      input: {
        submissionId: string;
        assessmentId: string;
        assessmentVersion: string;
        verdict: "pass" | "fail";
        met: number;
        total: number;
        evidence: ReceiptEvidence;
        observedAt?: Date;
      }
    ): Promise<{ receipt: PracticeReceipt; step: ProjectStep }> {
      const evidence = checkedEvidence(input.evidence);
      if (!Number.isInteger(input.met) || !Number.isInteger(input.total) || input.met > input.total) {
        throw new Error("Review counts are invalid.");
      }
      return db.transaction(async (tx) => {
        const [submission] = await tx
          .select()
          .from(practiceSubmissions)
          .where(
            and(
              eq(practiceSubmissions.id, input.submissionId),
              eq(practiceSubmissions.userId, userId)
            )
          )
          .for("update")
          .limit(1);
        if (!submission) throw new Error("Submission is unavailable.");

        const [row] = await tx
          .select({ run: projectRuns, step: projectSteps })
          .from(projectSteps)
          .innerJoin(projectRuns, eq(projectRuns.id, projectSteps.runId))
          .where(
            and(
              eq(projectSteps.id, submission.stepId),
              eq(projectRuns.id, submission.runId),
              eq(projectRuns.userId, userId)
            )
          )
          .for("update")
          .limit(1);
        if (!row) throw new Error("Practice step is unavailable.");

        const [existing] = await tx
          .select()
          .from(practiceReceipts)
          .where(
            and(
              eq(practiceReceipts.userId, userId),
              eq(practiceReceipts.sourceKind, "practice_submission"),
              eq(practiceReceipts.sourceRefId, submission.id)
            )
          )
          .limit(1);
        if (existing) return { receipt: existing, step: row.step };

        const observedAt = input.observedAt ?? new Date();
        let step = row.step;
        if (input.verdict === "pass" && row.step.status === "pending") {
          [step] = await tx
            .update(projectSteps)
            .set({
              status: "done",
              completion: "evidenced",
              artifact:
                `Reviewed against the rubric: ${input.met} of ${input.total} criteria met (attempt ${submission.attempt}).`.slice(
                  0,
                  1_000
                ),
              completedAt: observedAt,
              updatedAt: observedAt,
            })
            .where(eq(projectSteps.id, row.step.id))
            .returning();
        }

        const [receipt] = await tx
          .insert(practiceReceipts)
          .values({
            userId,
            runId: row.run.id,
            stepId: row.step.id,
            runLabel: row.run.title,
            stepLabel: row.step.title,
            assessmentKind: "rubric",
            assessmentId: input.assessmentId,
            assessmentVersion: input.assessmentVersion,
            verdict: input.verdict,
            strength: "observed",
            sourceKind: "practice_submission",
            sourceRefId: submission.id,
            observerId: "fadi.rubric-review",
            observerVersion: "1",
            evidence,
            observedAt,
          })
          .returning();

        if (input.verdict === "pass") {
          await settleRun(tx, row.run.id, row.run.status);
          const [settled] = await tx
            .select({ status: projectRuns.status })
            .from(projectRuns)
            .where(eq(projectRuns.id, row.run.id))
            .limit(1);
          if (settled) await settleProjectWork(tx, userId, row.run.id, settled.status);
        }
        return { receipt, step };
      });
    },

    async listForRun(userId: string, runId: string): Promise<PracticeReceipt[]> {
      return db
        .select()
        .from(practiceReceipts)
        .where(and(eq(practiceReceipts.userId, userId), eq(practiceReceipts.runId, runId)))
        .orderBy(desc(practiceReceipts.observedAt));
    },

    async listForStep(userId: string, stepId: string): Promise<PracticeReceipt[]> {
      return db
        .select()
        .from(practiceReceipts)
        .where(and(eq(practiceReceipts.userId, userId), eq(practiceReceipts.stepId, stepId)))
        .orderBy(desc(practiceReceipts.observedAt));
    },
  };
}

export type PracticeReceiptsRepository = ReturnType<typeof createPracticeReceiptsRepository>;
