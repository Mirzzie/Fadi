import { and, desc, eq } from "drizzle-orm";

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
  /** Track fields — see schema. */
  label?: string | null;
  domain?: string | null;
  intent?: string;
  roleCluster?: string[] | null;
  /** Make this the user's active track on create (deactivates the others). */
  makeActive?: boolean;
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

    /**
     * The user's ACTIVE career track — what jobs, the report, documents, and Kai
     * should all key off. Falls back to the latest profile when none is flagged
     * active yet (back-compat for rows created before tracks existed).
     */
    async getActiveForUser(userId: string): Promise<CareerProfile | null> {
      const [active] = await db
        .select()
        .from(careerProfiles)
        .where(and(eq(careerProfiles.userId, userId), eq(careerProfiles.isActive, true)))
        .orderBy(desc(careerProfiles.createdAt))
        .limit(1);

      if (active) return active;
      return this.getLatestForUser(userId);
    },

    /** All of a user's tracks, newest first. */
    async listForUser(userId: string): Promise<CareerProfile[]> {
      return db
        .select()
        .from(careerProfiles)
        .where(eq(careerProfiles.userId, userId))
        .orderBy(desc(careerProfiles.createdAt));
    },

    /** A single track, scoped to the owner (returns null if not theirs). */
    async getByIdForUser(userId: string, id: string): Promise<CareerProfile | null> {
      const [track] = await db
        .select()
        .from(careerProfiles)
        .where(and(eq(careerProfiles.userId, userId), eq(careerProfiles.id, id)))
        .limit(1);

      return track ?? null;
    },

    /** Switch the active track. Verifies ownership; clears the others atomically. */
    async setActiveForUser(userId: string, id: string): Promise<CareerProfile | null> {
      return db.transaction(async (tx) => {
        const [owned] = await tx
          .select()
          .from(careerProfiles)
          .where(and(eq(careerProfiles.userId, userId), eq(careerProfiles.id, id)))
          .limit(1);

        if (!owned) return null;

        await tx
          .update(careerProfiles)
          .set({ isActive: false, updatedAt: new Date() })
          .where(and(eq(careerProfiles.userId, userId), eq(careerProfiles.isActive, true)));

        const [updated] = await tx
          .update(careerProfiles)
          .set({ isActive: true, updatedAt: new Date() })
          .where(eq(careerProfiles.id, id))
          .returning();

        return updated;
      });
    },

    async createForUser(userId: string, input: CreateCareerProfileInput): Promise<CareerProfile> {
      return db.transaction(async (tx) => {
        if (input.makeActive) {
          await tx
            .update(careerProfiles)
            .set({ isActive: false, updatedAt: new Date() })
            .where(and(eq(careerProfiles.userId, userId), eq(careerProfiles.isActive, true)));
        }

        const [careerProfile] = await tx
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
            label: input.label ?? null,
            domain: input.domain ?? null,
            intent: input.intent ?? "career",
            roleCluster: input.roleCluster ?? null,
            isActive: input.makeActive ?? false,
          })
          .returning();

        return careerProfile;
      });
    },

    /** Update the user's ACTIVE track in place; create one (active) if none. */
    async updateLatestForUser(
      userId: string,
      patch: Partial<CreateCareerProfileInput>,
    ): Promise<CareerProfile> {
      const existing = await this.getActiveForUser(userId);

      if (!existing) {
        return this.createForUser(userId, {
          targetRole: patch.targetRole ?? "",
          careerGoal: patch.careerGoal ?? "",
          location: patch.location,
          experienceLevel: patch.experienceLevel,
          label: patch.label,
          domain: patch.domain,
          intent: patch.intent,
          roleCluster: patch.roleCluster,
          makeActive: true,
        });
      }

      const [updated] = await db
        .update(careerProfiles)
        .set({
          targetRole: patch.targetRole ?? existing.targetRole,
          location: patch.location ?? existing.location,
          experienceLevel: patch.experienceLevel ?? existing.experienceLevel,
          careerGoal: patch.careerGoal ?? existing.careerGoal,
          label: patch.label ?? existing.label,
          domain: patch.domain ?? existing.domain,
          intent: patch.intent ?? existing.intent,
          roleCluster: patch.roleCluster ?? existing.roleCluster,
          updatedAt: new Date(),
        })
        .where(eq(careerProfiles.id, existing.id))
        .returning();

      return updated;
    },
  };
}
