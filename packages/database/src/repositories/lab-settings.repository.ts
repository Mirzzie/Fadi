import { eq } from "drizzle-orm";

import type { Database } from "../client";
import { labSettings, type LabSettings } from "../schema/index";

/**
 * Where Fadi may write, and nowhere else.
 *
 * Absent by default, and absent means NO filesystem access rather than unrestricted —
 * the difference between a jail with no walls and a jail with no door.
 */
export function createLabSettingsRepository(db: Database) {
  return {
    async get(userId: string): Promise<LabSettings | null> {
      const [row] = await db
        .select()
        .from(labSettings)
        .where(eq(labSettings.userId, userId))
        .limit(1);
      return row ?? null;
    },

    async workspaceRoot(userId: string): Promise<string | null> {
      const row = await this.get(userId);
      return row?.workspaceRoot ?? null;
    },

    /** Set or clear the workspace. The path must already be resolved by the caller. */
    async setWorkspaceRoot(userId: string, resolvedPath: string | null): Promise<void> {
      await db
        .insert(labSettings)
        .values({ userId, workspaceRoot: resolvedPath })
        .onConflictDoUpdate({
          target: labSettings.userId,
          set: { workspaceRoot: resolvedPath, updatedAt: new Date() },
        });
    },
  };
}
