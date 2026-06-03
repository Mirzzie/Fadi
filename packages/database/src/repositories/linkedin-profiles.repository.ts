import { desc, eq } from "drizzle-orm";

import type { Database } from "../client";
import { linkedinProfiles, type LinkedInProfile } from "../schema/index";

export type CreateLinkedInProfileInput = {
  profileId?: string | null;
  profileUrl?: string | null;
  rawText?: string | null;
  importStatus?: string;
};

export function createLinkedInProfilesRepository(db: Database) {
  return {
    async getLatestForUser(userId: string): Promise<LinkedInProfile | null> {
      const [linkedinProfile] = await db
        .select()
        .from(linkedinProfiles)
        .where(eq(linkedinProfiles.userId, userId))
        .orderBy(desc(linkedinProfiles.createdAt))
        .limit(1);

      return linkedinProfile ?? null;
    },

    async createForUser(
      userId: string,
      input: CreateLinkedInProfileInput
    ): Promise<LinkedInProfile> {
      const [linkedinProfile] = await db
        .insert(linkedinProfiles)
        .values({
          userId,
          profileId: input.profileId ?? null,
          profileUrl: input.profileUrl ?? null,
          rawText: input.rawText ?? null,
          importStatus: input.importStatus ?? "manual_text",
        })
        .returning();

      return linkedinProfile;
    },
  };
}
