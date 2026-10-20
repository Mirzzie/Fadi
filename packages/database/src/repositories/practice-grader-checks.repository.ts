import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../client";
import { practiceGraderChecks, type PracticeGraderCheck } from "../schema/index";

type Identity = { provider: string; model: string; evalVersion: string };

/** A person's marking checks, newest first per model. Owner-scoped; rows are never edited. */
export function createPracticeGraderChecksRepository(db: Database) {
  return {
    async latest(userId: string, identity: Identity): Promise<PracticeGraderCheck | null> {
      const [row] = await db
        .select()
        .from(practiceGraderChecks)
        .where(
          and(
            eq(practiceGraderChecks.userId, userId),
            eq(practiceGraderChecks.provider, identity.provider),
            eq(practiceGraderChecks.model, identity.model),
            eq(practiceGraderChecks.evalVersion, identity.evalVersion)
          )
        )
        .orderBy(desc(practiceGraderChecks.createdAt))
        .limit(1);
      return row ?? null;
    },

    async record(
      userId: string,
      input: Identity & { releasable: boolean; report: Record<string, unknown> }
    ): Promise<PracticeGraderCheck> {
      const [row] = await db
        .insert(practiceGraderChecks)
        .values({ userId, ...input })
        .returning();
      return row!;
    },
  };
}

export type PracticeGraderChecksRepository = ReturnType<
  typeof createPracticeGraderChecksRepository
>;
