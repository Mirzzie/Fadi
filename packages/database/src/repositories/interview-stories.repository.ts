import { and, count, desc, eq } from "drizzle-orm";

import type { Database } from "../client";
import { interviewStories, type InterviewStory, type NewInterviewStory } from "../schema";

/**
 * The interview story bank — reusable STAR+Reflection stories grounded in the
 * candidate's real experience. CRUD only; the extraction/matching logic lives in
 * the app service so this stays a thin, testable data layer.
 */
export function createInterviewStoriesRepository(db: Database) {
  return {
    async listForUser(userId: string, limit = 50): Promise<InterviewStory[]> {
      return db
        .select()
        .from(interviewStories)
        .where(eq(interviewStories.userId, userId))
        .orderBy(desc(interviewStories.updatedAt))
        .limit(limit);
    },

    async getForUser(userId: string, id: string): Promise<InterviewStory | null> {
      const [row] = await db
        .select()
        .from(interviewStories)
        .where(and(eq(interviewStories.id, id), eq(interviewStories.userId, userId)))
        .limit(1);
      return row ?? null;
    },

    async create(
      userId: string,
      input: Omit<NewInterviewStory, "id" | "userId" | "createdAt" | "updatedAt">,
    ): Promise<InterviewStory> {
      const [created] = await db
        .insert(interviewStories)
        .values({ ...input, userId })
        .returning();
      return created;
    },

    /** Insert several at once (the AI extraction path). */
    async createMany(
      userId: string,
      rows: Array<Omit<NewInterviewStory, "id" | "userId" | "createdAt" | "updatedAt">>,
    ): Promise<InterviewStory[]> {
      if (rows.length === 0) return [];
      return db
        .insert(interviewStories)
        .values(rows.map((r) => ({ ...r, userId })))
        .returning();
    },

    async update(
      userId: string,
      id: string,
      patch: Partial<
        Pick<
          InterviewStory,
          "title" | "competencies" | "situation" | "task" | "action" | "result" | "reflection"
        >
      >,
    ): Promise<InterviewStory | null> {
      const [updated] = await db
        .update(interviewStories)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(interviewStories.id, id), eq(interviewStories.userId, userId)))
        .returning();
      return updated ?? null;
    },

    async delete(userId: string, id: string): Promise<void> {
      await db
        .delete(interviewStories)
        .where(and(eq(interviewStories.id, id), eq(interviewStories.userId, userId)));
    },

    async count(userId: string): Promise<number> {
      const [row] = await db
        .select({ value: count() })
        .from(interviewStories)
        .where(eq(interviewStories.userId, userId));
      return row?.value ?? 0;
    },
  };
}
