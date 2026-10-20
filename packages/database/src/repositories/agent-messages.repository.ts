import { and, desc, eq, isNull } from "drizzle-orm";

import type { Database } from "../client";
import { agentMessages, type AgentMessage } from "../schema";

export type CreateAgentMessageInput = {
  role: string;
  content: string;
  contextSummary?: string | null;
  metadata?: Record<string, unknown>;
  /** The work this turn is about. Null / omitted is the general conversation. */
  workItemId?: string | null;
};

/** Which conversation to read. Omitted means every turn, whatever it was about. */
export type ThreadScope = { workItemId?: string | null };

/**
 * Fadi conversation memory. One row per turn (user / assistant), so Fadi's chat
 * persists across sessions and is shared between Desk and Fadi modes (both load
 * the same history).
 *
 * A turn can belong to a piece of work. Asking "is this ready to send?" while standing on one
 * application should not be answered out of a conversation about a different one, so the thread
 * is scoped to the work and the general conversation is the thread with no work attached.
 */
export function createAgentMessagesRepository(db: Database) {
  return {
    /** Most recent messages, returned in chronological (oldest→newest) order. */
    async listRecentForUser(
      userId: string,
      limit = 50,
      scope: ThreadScope = {}
    ): Promise<AgentMessage[]> {
      const thread =
        scope.workItemId === undefined
          ? undefined
          : scope.workItemId === null
            ? isNull(agentMessages.workItemId)
            : eq(agentMessages.workItemId, scope.workItemId);

      const rows = await db
        .select()
        .from(agentMessages)
        .where(and(eq(agentMessages.userId, userId), thread))
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
          workItemId: input.workItemId ?? null,
        })
        .returning();
      return row;
    },

    async clearForUser(userId: string, scope: ThreadScope = {}): Promise<void> {
      const thread =
        scope.workItemId === undefined
          ? undefined
          : scope.workItemId === null
            ? isNull(agentMessages.workItemId)
            : eq(agentMessages.workItemId, scope.workItemId);
      await db.delete(agentMessages).where(and(eq(agentMessages.userId, userId), thread));
    },
  };
}
