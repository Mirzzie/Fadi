import { and, asc, eq } from "drizzle-orm";

import type { DbOrTx } from "../client";
import { mcpConnections, type McpConnection } from "../schema";

export type ConnectionTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type UpsertConnectionInput = {
  label: string;
  slug: string;
  url: string;
  authCiphertext?: string | null;
  autoApprove?: boolean;
};

/** The MCP servers a person has connected, so their tools become things Fadi can do. */
export function createMcpConnectionsRepository(db: DbOrTx) {
  return {
    async listForUser(userId: string): Promise<McpConnection[]> {
      return db
        .select()
        .from(mcpConnections)
        .where(eq(mcpConnections.userId, userId))
        .orderBy(asc(mcpConnections.label));
    },

    async get(userId: string, id: string): Promise<McpConnection | undefined> {
      const [row] = await db
        .select()
        .from(mcpConnections)
        .where(and(eq(mcpConnections.userId, userId), eq(mcpConnections.id, id)))
        .limit(1);
      return row;
    },

    async getBySlug(userId: string, slug: string): Promise<McpConnection | undefined> {
      const [row] = await db
        .select()
        .from(mcpConnections)
        .where(and(eq(mcpConnections.userId, userId), eq(mcpConnections.slug, slug)))
        .limit(1);
      return row;
    },

    /** Adding the same server twice updates it rather than making a second copy. */
    async upsert(userId: string, input: UpsertConnectionInput): Promise<McpConnection> {
      const [row] = await db
        .insert(mcpConnections)
        .values({
          userId,
          label: input.label,
          slug: input.slug,
          url: input.url,
          authCiphertext: input.authCiphertext ?? null,
          autoApprove: input.autoApprove ?? false,
        })
        .onConflictDoUpdate({
          target: [mcpConnections.userId, mcpConnections.slug],
          set: {
            label: input.label,
            url: input.url,
            ...(input.authCiphertext !== undefined
              ? { authCiphertext: input.authCiphertext }
              : {}),
            ...(input.autoApprove !== undefined ? { autoApprove: input.autoApprove } : {}),
            updatedAt: new Date(),
          },
        })
        .returning();
      return row;
    },

    /** What the server offered, and how the conversation went. Both are facts about one try. */
    async recordProbe(
      userId: string,
      id: string,
      probe: { status: string; detail?: string; tools?: ConnectionTool[] }
    ): Promise<void> {
      await db
        .update(mcpConnections)
        .set({
          status: probe.status,
          statusDetail: probe.detail ?? "",
          ...(probe.tools ? { tools: probe.tools } : {}),
          lastCheckedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(mcpConnections.userId, userId), eq(mcpConnections.id, id)));
    },

    async setAutoApprove(userId: string, id: string, autoApprove: boolean): Promise<void> {
      await db
        .update(mcpConnections)
        .set({ autoApprove, updatedAt: new Date() })
        .where(and(eq(mcpConnections.userId, userId), eq(mcpConnections.id, id)));
    },

    async remove(userId: string, id: string): Promise<boolean> {
      const rows = await db
        .delete(mcpConnections)
        .where(and(eq(mcpConnections.userId, userId), eq(mcpConnections.id, id)))
        .returning({ id: mcpConnections.id });
      return rows.length > 0;
    },
  };
}

export type McpConnectionsRepository = ReturnType<typeof createMcpConnectionsRepository>;
