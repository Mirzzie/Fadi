import { eq } from "drizzle-orm";

import type { Database } from "../client";
import { profiles, type Profile } from "../schema/index";

export type UpsertProfileInput = {
  fullName: string;
  email: string;
  onboardingCompleted?: boolean;
  onboardingCompletedAt?: Date | null;
};

export function createProfilesRepository(db: Database) {
  return {
    async getByUserId(userId: string): Promise<Profile | null> {
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);
      return profile ?? null;
    },

    async upsertForUser(userId: string, input: UpsertProfileInput): Promise<Profile> {
      const [profile] = await db
        .insert(profiles)
        .values({
          userId,
          fullName: input.fullName,
          email: input.email,
          onboardingCompleted: input.onboardingCompleted ?? false,
          onboardingCompletedAt: input.onboardingCompletedAt ?? null,
        })
        .onConflictDoUpdate({
          target: profiles.userId,
          set: {
            fullName: input.fullName,
            email: input.email,
            onboardingCompleted: input.onboardingCompleted ?? false,
            onboardingCompletedAt: input.onboardingCompletedAt ?? null,
            updatedAt: new Date(),
          },
        })
        .returning();

      return profile;
    },

    async markOnboardingCompleted(userId: string): Promise<Profile | null> {
      const [profile] = await db
        .update(profiles)
        .set({
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(profiles.userId, userId))
        .returning();

      return profile ?? null;
    },

    /** Toggle Fadi's auto-prep (auto-draft the full doc packet when engaging a job). */
    async setAutoPrep(userId: string, enabled: boolean): Promise<Profile | null> {
      const [profile] = await db
        .update(profiles)
        .set({ autoPrepEnabled: enabled, updatedAt: new Date() })
        .where(eq(profiles.userId, userId))
        .returning();

      return profile ?? null;
    },

    /** Persist the user's job-search preferences (used as discovery defaults). */
    async setJobPreferences(
      userId: string,
      prefs: {
        modes?: string[];
        types?: string[];
        autoSearch?: boolean;
        agentScope?: "filters" | "broad";
        location?: { country?: string; city?: string; precise?: boolean };
      },
    ): Promise<Profile | null> {
      const [profile] = await db
        .update(profiles)
        .set({ jobPreferences: prefs, updatedAt: new Date() })
        .where(eq(profiles.userId, userId))
        .returning();
      return profile ?? null;
    },

    /** Store (or clear) the user's BYO Notion integration credentials. */
    async setNotionIntegration(
      userId: string,
      input: { tokenCiphertext: string | null; databaseId: string | null },
    ): Promise<Profile | null> {
      const [profile] = await db
        .update(profiles)
        .set({
          notionTokenCiphertext: input.tokenCiphertext,
          notionDatabaseId: input.databaseId,
          updatedAt: new Date(),
        })
        .where(eq(profiles.userId, userId))
        .returning();

      return profile ?? null;
    },
  };
}
