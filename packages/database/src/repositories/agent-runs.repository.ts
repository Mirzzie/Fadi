import { and, desc, eq, isNull } from "drizzle-orm";

import type { Database } from "../client";
import {
  agentFindings,
  agentRuns,
  type AgentFinding,
  type AgentRun,
  type NewAgentFinding,
} from "../schema";

export type CreateFindingInput = Omit<NewAgentFinding, "id" | "runId" | "userId" | "createdAt" | "seenAt">;

/**
 * Fadi's background agency ledger. Every digest claim must trace back to a
 * finding row written by a real run — that's what keeps "since you were away"
 * honest instead of generated.
 */
export function createAgentRunsRepository(db: Database) {
  return {
    async startRun(userId: string): Promise<AgentRun> {
      const [row] = await db.insert(agentRuns).values({ userId }).returning();
      return row;
    },

    async finishRun(
      runId: string,
      outcome: { status: "ok" | "error"; findingsCount: number; error?: string | null },
    ): Promise<void> {
      await db
        .update(agentRuns)
        .set({
          status: outcome.status,
          findingsCount: outcome.findingsCount,
          error: outcome.error ?? null,
          finishedAt: new Date(),
        })
        .where(eq(agentRuns.id, runId));
    },

    /** Most recent run in ANY state — used as the re-run throttle/lock. */
    async getLastRunForUser(userId: string): Promise<AgentRun | null> {
      const [row] = await db
        .select()
        .from(agentRuns)
        .where(eq(agentRuns.userId, userId))
        .orderBy(desc(agentRuns.startedAt))
        .limit(1);
      return row ?? null;
    },

    /** Most recent COMPLETED run — the honest baseline for "since you were away". */
    async getLastFinishedRunForUser(userId: string): Promise<AgentRun | null> {
      const [row] = await db
        .select()
        .from(agentRuns)
        .where(and(eq(agentRuns.userId, userId), eq(agentRuns.status, "ok")))
        .orderBy(desc(agentRuns.startedAt))
        .limit(1);
      return row ?? null;
    },

    async insertFindings(
      runId: string,
      userId: string,
      findings: CreateFindingInput[],
    ): Promise<AgentFinding[]> {
      if (findings.length === 0) return [];
      return db
        .insert(agentFindings)
        .values(findings.map((f) => ({ ...f, runId, userId })))
        .returning();
    },

    /** Findings the user hasn't been shown yet, newest first. */
    async listUnseenForUser(userId: string, limit = 20): Promise<AgentFinding[]> {
      return db
        .select()
        .from(agentFindings)
        .where(and(eq(agentFindings.userId, userId), isNull(agentFindings.seenAt)))
        .orderBy(desc(agentFindings.createdAt))
        .limit(limit);
    },

    async markSeenForUser(userId: string): Promise<void> {
      await db
        .update(agentFindings)
        .set({ seenAt: new Date() })
        .where(and(eq(agentFindings.userId, userId), isNull(agentFindings.seenAt)));
    },

    /** Recent findings regardless of seen state (for Fadi's context window). */
    async listRecentForUser(userId: string, limit = 12): Promise<AgentFinding[]> {
      return db
        .select()
        .from(agentFindings)
        .where(eq(agentFindings.userId, userId))
        .orderBy(desc(agentFindings.createdAt))
        .limit(limit);
    },
  };
}
