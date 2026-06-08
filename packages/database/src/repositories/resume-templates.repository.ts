import { and, asc, eq } from "drizzle-orm";

import type { Database } from "../client";
import { resumeTemplates, type ResumeTemplateRow } from "../schema";

export type SaveResumeTemplateInput = {
  name: string;
  config: Record<string, unknown>;
};

export function createResumeTemplatesRepository(db: Database) {
  return {
    async listForUser(userId: string): Promise<ResumeTemplateRow[]> {
      return db
        .select()
        .from(resumeTemplates)
        .where(eq(resumeTemplates.userId, userId))
        .orderBy(asc(resumeTemplates.name));
    },

    async createForUser(userId: string, input: SaveResumeTemplateInput): Promise<ResumeTemplateRow> {
      const [row] = await db
        .insert(resumeTemplates)
        .values({ userId, name: input.name, config: input.config })
        .returning();
      return row;
    },

    /** Delete a template the user owns. Returns true if a row was removed. */
    async deleteForUser(userId: string, id: string): Promise<boolean> {
      const removed = await db
        .delete(resumeTemplates)
        .where(and(eq(resumeTemplates.userId, userId), eq(resumeTemplates.id, id)))
        .returning({ id: resumeTemplates.id });
      return removed.length > 0;
    },
  };
}
