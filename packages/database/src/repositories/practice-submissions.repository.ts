import { and, asc, desc, eq, max } from "drizzle-orm";

import type { Database } from "../client";
import {
  practiceSubmissions,
  projectRuns,
  projectSteps,
  type PracticeSubmission,
} from "../schema/index";

/** Long enough for a one-page memo with room to spare; bounded so a paste can't flood a review. */
export const MAX_SUBMISSION_CHARS = 12_000;

/**
 * What a person hands in for a document step: numbered, immutable attempts. Owner-scoped through
 * the run; a submission is only accepted for an open step of a running Practice-pack project.
 */
export function createPracticeSubmissionsRepository(db: Database) {
  return {
    async submit(
      userId: string,
      input: { runId: string; stepId: string; body: string; hintsUsed?: number }
    ): Promise<PracticeSubmission | null> {
      const body = input.body.trim();
      if (!body || body.length > MAX_SUBMISSION_CHARS) return null;
      return db.transaction(async (tx) => {
        const [row] = await tx
          .select({ step: projectSteps, run: projectRuns })
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
        if (
          !row ||
          !row.run.practice ||
          row.run.status !== "running" ||
          row.step.status !== "pending"
        ) {
          return null;
        }
        const [current] = await tx
          .select({ id: projectSteps.id })
          .from(projectSteps)
          .where(and(eq(projectSteps.runId, input.runId), eq(projectSteps.status, "pending")))
          .orderBy(asc(projectSteps.ordinal))
          .limit(1);
        if (!current || current.id !== input.stepId) return null;
        const [{ last }] = await tx
          .select({ last: max(practiceSubmissions.attempt) })
          .from(practiceSubmissions)
          .where(eq(practiceSubmissions.stepId, input.stepId));
        const [created] = await tx
          .insert(practiceSubmissions)
          .values({
            userId,
            runId: input.runId,
            stepId: input.stepId,
            attempt: (last ?? 0) + 1,
            body,
            hintsUsed: Math.max(0, Math.min(input.hintsUsed ?? 0, 10)),
          })
          .returning();
        return created ?? null;
      });
    },

    async get(userId: string, submissionId: string): Promise<PracticeSubmission | null> {
      const [row] = await db
        .select()
        .from(practiceSubmissions)
        .where(
          and(eq(practiceSubmissions.id, submissionId), eq(practiceSubmissions.userId, userId))
        )
        .limit(1);
      return row ?? null;
    },

    async latestForStep(userId: string, stepId: string): Promise<PracticeSubmission | null> {
      const [row] = await db
        .select()
        .from(practiceSubmissions)
        .where(and(eq(practiceSubmissions.stepId, stepId), eq(practiceSubmissions.userId, userId)))
        .orderBy(desc(practiceSubmissions.attempt))
        .limit(1);
      return row ?? null;
    },
  };
}

export type PracticeSubmissionsRepository = ReturnType<typeof createPracticeSubmissionsRepository>;
