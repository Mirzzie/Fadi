import { desc, eq } from "drizzle-orm";

import type { Database } from "../client";
import { agentMessages, type AgentMessage } from "../schema";

export type CreateAgentMessageInput = {
  role: string;
  content: string;
  contextSummary?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Kai conversation memory. One row per turn (user / assistant), so Kai's chat
 * persists across sessions and is shared between Desk and Kai modes (both load
 * the same history).
 */
export function createAgentMessagesRepository(db: Database) {
  return {
    /** Most recent messages, returned in chronological (oldest→newest) order. */
    async listRecentForUser(userId: string, limit = 50): Promise<AgentMessage[]> {
      const rows = await db
        .select()
        .from(agentMessages)
        .where(eq(agentMessages.userId, userId))
        .orderBy(desc(agentMessages.createdAt))
        .limit(limit);
      return rows.reverse();
    },

    async createForUser(userId: string, input: CreateAgentMessageInput): Promise<AgentMessage> {
      const [row] = await db
        .insert(agentMessages)
        .values({
          userId,
          role: input.role,
          content: input.content,
          contextSummary: input.contextSummary ?? null,
          metadata: input.metadata ?? {},
        })
        .returning();
      return row;
    },

    async clearForUser(userId: string): Promise<void> {
      await db.delete(agentMessages).where(eq(agentMessages.userId, userId));
    },
  };
}
