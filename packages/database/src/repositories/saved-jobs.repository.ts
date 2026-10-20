import { and, eq, inArray, isNull, or } from "drizzle-orm";

import type { Database } from "../client";
import { savedJobs, type SavedJob } from "../schema";

export type SaveJobInput = {
  matchScore?: number | null;
  matchSummary?: string | null;
  matchedSkills?: string[];
  missingSkills?: string[];
  /** The direction this job was saved under (the user's active track). */
  careerProfileId?: string | null;
};

/**
 * How the pipeline reacts to the active direction.
 * - "active": only this track's rows (plus untracked legacy rows).
 * - "all": every track (the user runs several directions in parallel).
 */
export type TrackScope = { scope: "active"; careerProfileId: string | null } | { scope: "all" };

/**
 * Track filter. Rows with a NULL career_profile_id are legacy (saved before the
 * pipeline was track-aware) and stay visible in EVERY track — migrating must
 * never make a user's saved jobs disappear.
 */
function trackFilter(scope: TrackScope) {
  if (scope.scope === "all") return undefined;
  return scope.careerProfileId
    ? or(eq(savedJobs.careerProfileId, scope.careerProfileId), isNull(savedJobs.careerProfileId))
    : isNull(savedJobs.careerProfileId);
}

export function createSavedJobsRepository(db: Database) {
  return {
    /** Defaults to "all" so existing callers keep their current behaviour. */
    async listForUser(userId: string, scope: TrackScope = { scope: "all" }): Promise<SavedJob[]> {
      return db
        .select()
        .from(savedJobs)
        .where(and(eq(savedJobs.userId, userId), trackFilter(scope)));
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
          careerProfileId: input.careerProfileId ?? null,
          status: "saved",
          matchScore: input.matchScore ?? null,
          matchSummary: input.matchSummary ?? null,
          matchedSkills: input.matchedSkills ?? [],
          missingSkills: input.missingSkills ?? [],
        })
        .onConflictDoUpdate({
          target: [savedJobs.userId, savedJobs.jobId],
          set: {
            // Re-saving under a different direction re-homes the job to the track
            // the user is actually in now.
            careerProfileId: input.careerProfileId ?? null,
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
