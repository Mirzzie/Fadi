import { and, desc, eq, isNull } from "drizzle-orm";

import type { Database } from "../client";
import { resumes, type Resume } from "../schema/index";

export type CreateResumeInput = {
  profileId?: string | null;
  careerProfileId?: string | null;
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

    /**
     * Latest resume for a career direction. Prefers a resume tagged to THIS track;
     * falls back to a legacy/shared (untagged) resume so a direction without its own
     * still shows something until the user saves one. Career history (LinkedIn) stays
     * shared per-user — only the role-tailored resume is per-track.
     */
    async getLatestForTrack(userId: string, careerProfileId: string | null): Promise<Resume | null> {
      if (careerProfileId) {
        const [tracked] = await db
          .select()
          .from(resumes)
          .where(and(eq(resumes.userId, userId), eq(resumes.careerProfileId, careerProfileId)))
          .orderBy(desc(resumes.createdAt))
          .limit(1);
        if (tracked) return tracked;
      }
      const [legacy] = await db
        .select()
        .from(resumes)
        .where(and(eq(resumes.userId, userId), isNull(resumes.careerProfileId)))
        .orderBy(desc(resumes.createdAt))
        .limit(1);
      return legacy ?? null;
    },

    /**
     * Delete a direction's tailored resumes when the direction itself is deleted.
     * Without this, ON DELETE SET NULL turns the deleted track's resume into the
     * NEWEST untagged row — which getLatestForTrack would then pick as the shared
     * fallback for every other direction, silently poisoning their generation.
     */
    async deleteForTrack(userId: string, careerProfileId: string): Promise<number> {
      const deleted = await db
        .delete(resumes)
        .where(and(eq(resumes.userId, userId), eq(resumes.careerProfileId, careerProfileId)))
        .returning({ id: resumes.id });
      return deleted.length;
    },

    async createForUser(userId: string, input: CreateResumeInput): Promise<Resume> {
      const [resume] = await db
        .insert(resumes)
        .values({
          userId,
          profileId: input.profileId ?? null,
          careerProfileId: input.careerProfileId ?? null,
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

    /**
     * Update THIS track's resume text in place, or create one tagged to the track if
     * it doesn't have its own yet (the legacy/shared resume is left intact as the
     * fallback for other directions). careerProfileId null → user-wide upsert.
     */
    async upsertLatestForTrack(
      userId: string,
      careerProfileId: string | null,
      rawText: string,
    ): Promise<Resume> {
      const scope = careerProfileId
        ? and(eq(resumes.userId, userId), eq(resumes.careerProfileId, careerProfileId))
        : and(eq(resumes.userId, userId), isNull(resumes.careerProfileId));
      const [existing] = await db
        .select()
        .from(resumes)
        .where(scope)
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
        .values({ userId, careerProfileId, rawText, parsedText: rawText, parseStatus: "manual_text" })
        .returning();
      return created;
    },
  };
}
