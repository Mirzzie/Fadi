import { desc, eq } from "drizzle-orm";

import type { Database } from "../client";
import { careerProfiles, type CareerProfile } from "../schema/index";

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

    /** Update the user's latest career profile in place; create one if none. */
    async updateLatestForUser(
      userId: string,
      patch: Partial<CreateCareerProfileInput>,
    ): Promise<CareerProfile> {
      const [existing] = await db
        .select()
        .from(careerProfiles)
        .where(eq(careerProfiles.userId, userId))
        .orderBy(desc(careerProfiles.createdAt))
        .limit(1);

      if (!existing) {
        return this.createForUser(userId, {
          targetRole: patch.targetRole ?? "",
          careerGoal: patch.careerGoal ?? "",
          location: patch.location,
          experienceLevel: patch.experienceLevel,
        });
      }

      const [updated] = await db
        .update(careerProfiles)
        .set({
          targetRole: patch.targetRole ?? existing.targetRole,
          location: patch.location ?? existing.location,
          experienceLevel: patch.experienceLevel ?? existing.experienceLevel,
          careerGoal: patch.careerGoal ?? existing.careerGoal,
          updatedAt: new Date(),
        })
        .where(eq(careerProfiles.id, existing.id))
        .returning();

      return updated;
    },
  };
}
