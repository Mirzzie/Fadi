import { desc, eq } from "drizzle-orm";

import type { Database } from "../client";
import { resumes, type Resume } from "../schema/index";

export type CreateResumeInput = {
  profileId?: string | null;
  fileName?: string | null;
  filePath?: string | null;
  fileMimeType?: string | null;
  rawText?: string | null;
  parsedText?: string | null;
  parseStatus?: string;
};

export function createResumesRepository(db: Database) {
  return {
    async getLatestForUser(userId: string): Promise<Resume | null> {
      const [resume] = await db
        .select()
        .from(resumes)
        .where(eq(resumes.userId, userId))
        .orderBy(desc(resumes.createdAt))
        .limit(1);

      return resume ?? null;
    },

    async createForUser(userId: string, input: CreateResumeInput): Promise<Resume> {
      const [resume] = await db
        .insert(resumes)
        .values({
          userId,
          profileId: input.profileId ?? null,
          fileName: input.fileName ?? null,
          filePath: input.filePath ?? null,
          fileMimeType: input.fileMimeType ?? null,
          rawText: input.rawText ?? null,
          parsedText: input.parsedText ?? input.rawText ?? null,
          parseStatus: input.parseStatus ?? "manual_text",
        })
        .returning();

      return resume;
    },

    /** Update the user's latest resume text in place, or create one if none exists. */
    async upsertLatestForUser(userId: string, rawText: string): Promise<Resume> {
      const [existing] = await db
        .select()
        .from(resumes)
        .where(eq(resumes.userId, userId))
        .orderBy(desc(resumes.createdAt))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(resumes)
          .set({ rawText, parsedText: rawText, updatedAt: new Date() })
          .where(eq(resumes.id, existing.id))
          .returning();
        return updated;
      }

      const [created] = await db
        .insert(resumes)
        .values({ userId, rawText, parsedText: rawText, parseStatus: "manual_text" })
        .returning();
      return created;
    },
  };
}
