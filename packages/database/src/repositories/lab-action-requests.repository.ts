import { and, desc, eq, gt } from "drizzle-orm";

import type { Database } from "../client";
import {
  labActionRequests,
  type LabActionRequest,
  type NewLabActionRequest,
} from "../schema/index";

/**
 * WRITES WAITING FOR A PERSON.
 *
 * The asymmetry this table exists to enforce: a model may PROPOSE, only a person may
 * APPROVE. Every state change here is one-way and conditional — `approve` only moves a
 * row that is still `pending` and still unexpired, so a stale prompt clicked tomorrow
 * cannot authorise anything, and the same approval cannot be spent twice.
 *
 * The conditions live in the WHERE clause rather than in a read-then-write, because two
 * requests arriving together must not both find the row pending and both execute.
 */
export function createLabActionRequestsRepository(db: Database) {
  return {
    async propose(
      input: Omit<NewLabActionRequest, "id" | "createdAt" | "updatedAt" | "status">,
    ): Promise<LabActionRequest> {
      const [row] = await db
        .insert(labActionRequests)
        .values({ ...input, status: "pending" })
        .returning();
      return row;
    },

    /** Read one request without claiming it — for checking a confirmation before spending it. */
    async get(userId: string, id: string): Promise<LabActionRequest | null> {
      const [row] = await db
        .select()
        .from(labActionRequests)
        .where(and(eq(labActionRequests.userId, userId), eq(labActionRequests.id, id)))
        .limit(1);
      return row ?? null;
    },

    /** Live prompts: pending, not expired. Anything else is history. */
    async listPending(userId: string): Promise<LabActionRequest[]> {
      return db
        .select()
        .from(labActionRequests)
        .where(
          and(
            eq(labActionRequests.userId, userId),
            eq(labActionRequests.status, "pending"),
            gt(labActionRequests.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(labActionRequests.createdAt));
    },

    async recent(userId: string, limit = 25): Promise<LabActionRequest[]> {
      return db
        .select()
        .from(labActionRequests)
        .where(eq(labActionRequests.userId, userId))
        .orderBy(desc(labActionRequests.createdAt))
        .limit(limit);
    },

    /**
     * Claim a pending request for execution.
     *
     * Returns the row ONLY if this call is the one that moved it out of `pending`. Two
     * clicks on the same prompt, or a retry racing itself, must not run the command
     * twice — so the guard is the UPDATE's own WHERE clause, not a check beforehand.
     *
     * Expiry is checked here too: approval is consent to what is happening now, and a
     * prompt that has been sitting open is not that.
     */
    async approve(userId: string, id: string): Promise<LabActionRequest | null> {
      const [row] = await db
        .update(labActionRequests)
        .set({ status: "approved", decidedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(labActionRequests.userId, userId),
            eq(labActionRequests.id, id),
            eq(labActionRequests.status, "pending"),
            gt(labActionRequests.expiresAt, new Date()),
          ),
        )
        .returning();
      return row ?? null;
    },

    async deny(userId: string, id: string): Promise<void> {
      await db
        .update(labActionRequests)
        .set({ status: "denied", decidedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(labActionRequests.userId, userId),
            eq(labActionRequests.id, id),
            eq(labActionRequests.status, "pending"),
          ),
        );
    },

    /** Record the outcome of something that actually ran. */
    async finish(
      userId: string,
      id: string,
      outcome: { status: "executed" | "failed"; detail: string },
    ): Promise<void> {
      await db
        .update(labActionRequests)
        .set({
          status: outcome.status,
          detail: outcome.detail,
          executedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(labActionRequests.userId, userId), eq(labActionRequests.id, id)));
    },

    /**
     * Replace the preflight notes on a still-pending request.
     *
     * Used when the situation changed between reading and approving: the prompt survives
     * and carries the new facts, rather than the decision being thrown away because the
     * check went stale.
     */
    async revise(userId: string, id: string, preflight: unknown): Promise<void> {
      await db
        .update(labActionRequests)
        .set({ preflight, updatedAt: new Date() })
        .where(
          and(
            eq(labActionRequests.userId, userId),
            eq(labActionRequests.id, id),
            eq(labActionRequests.status, "pending"),
          ),
        );
    },

    /** Executions of one recipe inside the last hour, for the rate ceiling. */
    async executedLastHour(userId: string, recipe: string): Promise<number> {
      const rows = await db
        .select({ id: labActionRequests.id })
        .from(labActionRequests)
        .where(
          and(
            eq(labActionRequests.userId, userId),
            eq(labActionRequests.recipe, recipe),
            eq(labActionRequests.status, "executed"),
            gt(labActionRequests.executedAt, new Date(Date.now() - 3_600_000)),
          ),
        );
      return rows.length;
    },

    /**
     * Names Fadi created, for recipes that may only act on Fadi's own work.
     *
     * A stop or remove must not be able to name a container the user set up themselves,
     * and the honest way to know which are Fadi's is to read what Fadi actually created
     * here rather than to trust a naming convention alone.
     */
    async createdNames(userId: string, recipe: string): Promise<string[]> {
      const rows = await db
        .select({ params: labActionRequests.params })
        .from(labActionRequests)
        .where(
          and(
            eq(labActionRequests.userId, userId),
            eq(labActionRequests.recipe, recipe),
            eq(labActionRequests.status, "executed"),
          ),
        )
        .orderBy(desc(labActionRequests.executedAt));
      return rows
        .map((r) => (r.params as { name?: unknown }).name)
        .filter((n): n is string => typeof n === "string");
    },
  };
}
