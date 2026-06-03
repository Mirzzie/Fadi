import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "../client";
import { savedJobs, type SavedJob } from "../schema";

export type SaveJobInput = {
  matchScore?: number | null;
  matchSummary?: string | null;
  matchedSkills?: string[];
  missingSkills?: string[];
};

export function createSavedJobsRepository(db: Database) {
  return {
    async listForUser(userId: string): Promise<SavedJob[]> {
      return db.select().from(savedJobs).where(eq(savedJobs.userId, userId));
    },

    async listForUserByJobIds(userId: string, jobIds: string[]): Promise<SavedJob[]> {
      if (jobIds.length === 0) {
        return [];
      }

      return db
        .select()
        .from(savedJobs)
        .where(and(eq(savedJobs.userId, userId), inArray(savedJobs.jobId, jobIds)));
    },

    async saveForUser(userId: string, jobId: string, input: SaveJobInput = {}): Promise<SavedJob> {
      const [savedJob] = await db
        .insert(savedJobs)
        .values({
          userId,
          jobId,
          status: "saved",
          matchScore: input.matchScore ?? null,
          matchSummary: input.matchSummary ?? null,
          matchedSkills: input.matchedSkills ?? [],
          missingSkills: input.missingSkills ?? [],
        })
        .onConflictDoUpdate({
          target: [savedJobs.userId, savedJobs.jobId],
          set: {
            status: "saved",
            matchScore: input.matchScore ?? null,
            matchSummary: input.matchSummary ?? null,
            matchedSkills: input.matchedSkills ?? [],
            missingSkills: input.missingSkills ?? [],
            updatedAt: new Date(),
          },
        })
        .returning();

      return savedJob;
    },

    async unsaveForUser(userId: string, jobId: string): Promise<void> {
      await db
        .delete(savedJobs)
        .where(and(eq(savedJobs.userId, userId), eq(savedJobs.jobId, jobId)));
    },
  };
}
