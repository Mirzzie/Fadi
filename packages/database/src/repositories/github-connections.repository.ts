import { eq } from "drizzle-orm";

import type { Database } from "../client";
import { githubConnections, type GithubConnection, type NewGithubConnection } from "../schema";

/**
 * The user's GitHub publishing connection (ADR 0008). One row per user (unique index).
 * The token is stored already-encrypted by the caller (lib/security/crypto); this
 * repository never sees or handles plaintext.
 */
export function createGithubConnectionsRepository(db: Database) {
  return {
    async getByUserId(userId: string): Promise<GithubConnection | null> {
      const [row] = await db
        .select()
        .from(githubConnections)
        .where(eq(githubConnections.userId, userId))
        .limit(1);
      return row ?? null;
    },

    async upsert(input: NewGithubConnection): Promise<GithubConnection> {
      const [existing] = await db
        .select()
        .from(githubConnections)
        .where(eq(githubConnections.userId, input.userId))
        .limit(1);

      if (existing) {
        const [row] = await db
          .update(githubConnections)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(githubConnections.id, existing.id))
          .returning();
        return row;
      }
      const [row] = await db.insert(githubConnections).values(input).returning();
      return row;
    },

    /** Patch publish-result fields after a successful push. */
    async markPublished(
      userId: string,
      patch: { repo?: string; pagesUrl?: string; githubLogin?: string; autoRefresh?: boolean },
    ): Promise<void> {
      await db
        .update(githubConnections)
        .set({ ...patch, lastPublishedAt: new Date(), updatedAt: new Date() })
        .where(eq(githubConnections.userId, userId));
    },

    async deleteForUser(userId: string): Promise<void> {
      await db.delete(githubConnections).where(eq(githubConnections.userId, userId));
    },
  };
}
