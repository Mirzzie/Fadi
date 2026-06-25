import { and, desc, eq, isNull } from "drizzle-orm";

import type { Database } from "../client";
import { mcpTokens, type McpToken, type NewMcpToken } from "../schema";

/**
 * MCP integration tokens — personal access tokens for FadiOS-as-Lego. Only the
 * hash is stored; the raw token is shown once at creation. Lookups resolve a
 * presented token (by hash) to its owning user, ignoring revoked tokens.
 */
export function createMcpTokensRepository(db: Database) {
  return {
    async create(
      userId: string,
      input: Pick<NewMcpToken, "name" | "tokenHash" | "prefix">,
    ): Promise<McpToken> {
      const [created] = await db
        .insert(mcpTokens)
        .values({ ...input, userId })
        .returning();
      return created;
    },

    /** All of a user's tokens, newest first (for the settings list). */
    async listForUser(userId: string): Promise<McpToken[]> {
      return db
        .select()
        .from(mcpTokens)
        .where(eq(mcpTokens.userId, userId))
        .orderBy(desc(mcpTokens.createdAt));
    },

    /** Resolve a presented token (by hash) to its active record, or null. */
    async findActiveByHash(tokenHash: string): Promise<McpToken | null> {
      const [row] = await db
        .select()
        .from(mcpTokens)
        .where(and(eq(mcpTokens.tokenHash, tokenHash), isNull(mcpTokens.revokedAt)))
        .limit(1);
      return row ?? null;
    },

    /** Revoke a token the user owns (soft delete). Returns true if it was theirs. */
    async revoke(userId: string, id: string): Promise<boolean> {
      const [row] = await db
        .update(mcpTokens)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(mcpTokens.id, id), eq(mcpTokens.userId, userId), isNull(mcpTokens.revokedAt)))
        .returning();
      return Boolean(row);
    },

    /** Stamp last-used (best-effort; never blocks the request). */
    async touchLastUsed(id: string): Promise<void> {
      await db.update(mcpTokens).set({ lastUsedAt: new Date() }).where(eq(mcpTokens.id, id));
    },
  };
}
