import { and, desc, eq, gt, isNull, or } from "drizzle-orm";

import type { Database } from "../client";
import {
  labActions,
  labGrants,
  type LabAction,
  type LabGrant,
  type NewLabAction,
} from "../schema/index";

/**
 * PERMISSION, NOT CONFIGURATION.
 *
 * The only question this repository answers is "is there, right now, a live grant for
 * this capability on this resource?" — and it answers it by reading the clock, not a
 * cached flag. Expiry that depends on a background job to sweep it is not expiry; a
 * grant nobody revoked but everybody forgot must go quiet on its own.
 */
export function createLabGrantsRepository(db: Database) {
  return {
    /**
     * Live means: granted to this user, for this capability, on this resource, not
     * revoked, and either open-ended or not yet expired.
     *
     * `resourceId: null` is the machine Fadi itself runs on. It is matched exactly, not
     * treated as a wildcard — a grant to inspect the Raspberry Pi is not a grant to
     * inspect the laptop, and collapsing the two would silently widen every permission
     * the user gave.
     */
    async findLive(
      userId: string,
      capability: string,
      resourceId: string | null = null,
    ): Promise<LabGrant | null> {
      const [row] = await db
        .select()
        .from(labGrants)
        .where(
          and(
            eq(labGrants.userId, userId),
            eq(labGrants.capability, capability),
            resourceId === null
              ? isNull(labGrants.resourceId)
              : eq(labGrants.resourceId, resourceId),
            isNull(labGrants.revokedAt),
            or(isNull(labGrants.expiresAt), gt(labGrants.expiresAt, new Date())),
          ),
        )
        .orderBy(desc(labGrants.createdAt))
        .limit(1);
      return row ?? null;
    },

    /** Everything the user has said yes to, including the dead ones — the log is the point. */
    async listForUser(userId: string): Promise<LabGrant[]> {
      return db
        .select()
        .from(labGrants)
        .where(eq(labGrants.userId, userId))
        .orderBy(desc(labGrants.createdAt));
    },

    async grant(input: {
      userId: string;
      capability: string;
      resourceId?: string | null;
      minutes: number;
      reason: string;
    }): Promise<LabGrant> {
      const [row] = await db
        .insert(labGrants)
        .values({
          userId: input.userId,
          capability: input.capability,
          resourceId: input.resourceId ?? null,
          expiresAt: new Date(Date.now() + input.minutes * 60_000),
          reason: input.reason,
        })
        .returning();
      return row;
    },

    /**
     * Revoke by CAPABILITY, not by grant id — and this distinction is a bug fix, not a
     * convenience.
     *
     * Grants accumulate: allow, let it lapse, allow again, and two rows for the same
     * capability can be live at once. `findLive` answers with the newest, so revoking a
     * single row by id would close the one the panel happened to be showing and leave an
     * older one still permitting access — while the UI said "not allowed". A permission
     * screen that lies in that direction is worse than no permission screen.
     *
     * So "Revoke" means what the person clicking it thinks it means: this capability is
     * closed, all of it.
     *
     * Sets a timestamp rather than deleting. "I allowed this on Tuesday and took it back
     * on Wednesday" is exactly the history someone needs when working out what happened,
     * and a DELETE erases it.
     */
    async revokeCapability(
      userId: string,
      capability: string,
      resourceId: string | null = null,
    ): Promise<number> {
      const rows = await db
        .update(labGrants)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(labGrants.userId, userId),
            eq(labGrants.capability, capability),
            resourceId === null
              ? isNull(labGrants.resourceId)
              : eq(labGrants.resourceId, resourceId),
            isNull(labGrants.revokedAt),
          ),
        )
        .returning({ id: labGrants.id });
      return rows.length;
    },

    /** The panic button. One click, everything closed. */
    async revokeAll(userId: string): Promise<number> {
      const rows = await db
        .update(labGrants)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(labGrants.userId, userId), isNull(labGrants.revokedAt)))
        .returning({ id: labGrants.id });
      return rows.length;
    },
  };
}

/**
 * THE AUDIT LOG.
 *
 * Append-only by construction: no update, no delete. A log a caller can edit is not
 * evidence of anything, and the whole reason this table exists is to be believed later.
 */
export function createLabActionsRepository(db: Database) {
  return {
    async record(input: Omit<NewLabAction, "id" | "createdAt">): Promise<void> {
      await db.insert(labActions).values(input);
    },

    async recent(userId: string, limit = 50): Promise<LabAction[]> {
      return db
        .select()
        .from(labActions)
        .where(eq(labActions.userId, userId))
        .orderBy(desc(labActions.createdAt))
        .limit(limit);
    },

    /**
     * Denials inside a recent window, for the circuit breaker.
     *
     * Returns actor and time only. The breaker's judgement is made by a pure function
     * that has no database access, so what it needs has to come to it — and keeping the
     * query this narrow means the rule cannot quietly start depending on something else.
     */
    async denialsSince(userId: string, since: Date): Promise<Array<{ actor: string; createdAt: Date }>> {
      return db
        .select({ actor: labActions.actor, createdAt: labActions.createdAt })
        .from(labActions)
        .where(
          and(
            eq(labActions.userId, userId),
            eq(labActions.decision, "denied"),
            gt(labActions.createdAt, since),
          ),
        );
    },

    /**
     * Everything that happened as part of one project run.
     *
     * What the project timeline filters on. Actions with a null `runId` are not missing
     * data — detecting this machine, sweeping the network, revoking a grant belong to no
     * project — so they are simply absent here rather than swept in under a guess.
     */
    async forRun(userId: string, runId: string, limit = 200): Promise<LabAction[]> {
      return db
        .select()
        .from(labActions)
        .where(and(eq(labActions.userId, userId), eq(labActions.runId, runId)))
        .orderBy(desc(labActions.createdAt))
        .limit(limit);
    },

    /**
     * Denials only, for the monitor.
     *
     * This is the query that matters. Successes are mostly the user's own work coming
     * back at them; a cluster of denials is the shape of something asking for what it
     * was never given.
     */
    async recentDenials(userId: string, limit = 20): Promise<LabAction[]> {
      return db
        .select()
        .from(labActions)
        .where(and(eq(labActions.userId, userId), eq(labActions.decision, "denied")))
        .orderBy(desc(labActions.createdAt))
        .limit(limit);
    },
  };
}
