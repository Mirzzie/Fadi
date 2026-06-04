import { eq } from "drizzle-orm";

import type { Database } from "../client";
import { userAiSettings, type NewUserAiSettings, type UserAiSettings } from "../schema";

export function createUserAiSettingsRepository(db: Database) {
  return {
    async getByUserId(userId: string): Promise<UserAiSettings | null> {
      const [row] = await db
        .select()
        .from(userAiSettings)
        .where(eq(userAiSettings.userId, userId))
        .limit(1);
      return row ?? null;
    },

    async upsert(input: NewUserAiSettings): Promise<UserAiSettings> {
      const [existing] = await db
        .select()
        .from(userAiSettings)
        .where(eq(userAiSettings.userId, input.userId))
        .limit(1);

      if (existing) {
        const [row] = await db
          .update(userAiSettings)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(userAiSettings.id, existing.id))
          .returning();
        return row;
      }

      const [row] = await db.insert(userAiSettings).values(input).returning();
      return row;
    },

    async deleteForUser(userId: string): Promise<void> {
      await db.delete(userAiSettings).where(eq(userAiSettings.userId, userId));
    },
  };
}
