import { desc, eq } from "drizzle-orm";

import type { Database } from "../client.js";
import { careerProfiles, type CareerProfile } from "../schema/index.js";

export type CreateCareerProfileInput = {
  profileId?: string | null;
  targetRole: string;
  location?: string | null;
  experienceLevel?: string | null;
  careerGoal: string;
  importedFrom?: string;
  analysisStatus?: string;
};

export function createCareerProfilesRepository(db: Database) {
  return {
    async getLatestForUser(userId: string): Promise<CareerProfile | null> {
      const [careerProfile] = await db
        .select()
        .from(careerProfiles)
        .where(eq(careerProfiles.userId, userId))
        .orderBy(desc(careerProfiles.createdAt))
        .limit(1);

      return careerProfile ?? null;
    },

    async createForUser(userId: string, input: CreateCareerProfileInput): Promise<CareerProfile> {
      const [careerProfile] = await db
        .insert(careerProfiles)
        .values({
          userId,
          profileId: input.profileId ?? null,
          targetRole: input.targetRole,
          location: input.location ?? null,
          experienceLevel: input.experienceLevel ?? null,
          careerGoal: input.careerGoal,
          importedFrom: input.importedFrom ?? "manual",
          analysisStatus: input.analysisStatus ?? "not_started",
        })
        .returning();

      return careerProfile;
    },
  };
}
