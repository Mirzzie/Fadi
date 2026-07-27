import { and, desc, eq } from "drizzle-orm";

import type { DbOrTx } from "../client";
import { learningCommitments, type LearningCommitment } from "../schema/index";

/**
 * Learning commitments — the gap→growth loop's persistence. Thin CRUD; the
 * completion→evidence hand-off lives in the app layer so this stays testable.
 */
export function createLearningCommitmentsRepository(db: DbOrTx) {
  return {
    async listForUser(userId: string, limit = 30): Promise<LearningCommitment[]> {
      return db
        .select()
        .from(learningCommitments)
        .where(eq(learningCommitments.userId, userId))
        .orderBy(desc(learningCommitments.createdAt))
        .limit(limit);
    },

    async getForUser(userId: string, id: string): Promise<LearningCommitment | null> {
      const [row] = await db
        .select()
        .from(learningCommitments)
        .where(and(eq(learningCommitments.id, id), eq(learningCommitments.userId, userId)))
        .limit(1);
      return row ?? null;
    },

    async createForUser(
      userId: string,
      input: {
        careerProfileId?: string | null;
        gap: string;
        title: string;
        detail?: string;
        kind?: string;
        searchQuery?: string | null;
      },
    ): Promise<LearningCommitment> {
      const [created] = await db
        .insert(learningCommitments)
        .values({
          userId,
          careerProfileId: input.careerProfileId ?? null,
          gap: input.gap,
          title: input.title,
          detail: input.detail ?? "",
          kind: input.kind ?? "project",
          searchQuery: input.searchQuery ?? null,
        })
        .returning();
      return created;
    },

    /** Mark completed and link the evidence item it produced. */
    async completeForUser(
      userId: string,
      id: string,
      evidenceItemId: string | null,
    ): Promise<LearningCommitment | null> {
      const [updated] = await db
        .update(learningCommitments)
        .set({ status: "completed", completedAt: new Date(), evidenceItemId, updatedAt: new Date() })
        .where(and(eq(learningCommitments.id, id), eq(learningCommitments.userId, userId)))
        .returning();
      return updated ?? null;
    },

    async deleteForUser(userId: string, id: string): Promise<void> {
      await db
        .delete(learningCommitments)
        .where(and(eq(learningCommitments.id, id), eq(learningCommitments.userId, userId)));
    },
  };
}
