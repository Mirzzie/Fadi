import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { DbOrTx } from "../client";
import { outboxEvents, type OutboxEvent } from "../schema";

/** After this many failed deliveries an event stops retrying and is shown as failed. */
export const OUTBOX_MAX_ATTEMPTS = 8;

/** 30s, 1m, 2m, 4m … capped at an hour. */
export function outboxBackoffMs(attempts: number): number {
  return Math.min(60 * 60_000, 30_000 * 2 ** Math.max(0, attempts - 1));
}

export function createOutboxRepository(db: DbOrTx) {
  return {
    /**
     * Queue a consequence. Call it with the producer's transaction so the event exists exactly
     * when the write it describes does. A second enqueue with the same key is a no-op.
     */
    async enqueue(
      userId: string,
      event: { topic: string; payload: Record<string, unknown>; dedupeKey: string }
    ): Promise<void> {
      await db
        .insert(outboxEvents)
        .values({ userId, ...event })
        .onConflictDoNothing({ target: outboxEvents.dedupeKey });
    },

    /**
     * Lease up to `limit` due events to this worker. SKIP LOCKED lets several workers (or two
     * requests draining at once) take disjoint batches; the lease makes a crashed worker's
     * events due again once it lapses, so nothing is stranded.
     */
    async claim(limit: number, leaseMs = 60_000): Promise<OutboxEvent[]> {
      const result = await db.execute(sql`
        update ${outboxEvents}
        set locked_until = now() + (${leaseMs} * interval '1 millisecond'),
            attempts = attempts + 1
        where id in (
          select id from ${outboxEvents}
          where status = 'pending'
            and available_at <= now()
            and (locked_until is null or locked_until < now())
          order by created_at
          limit ${limit}
          for update skip locked
        )
        returning id
      `);
      const ids = (result.rows as Array<{ id: string }>).map((row) => row.id);
      if (ids.length === 0) return [];
      return db.select().from(outboxEvents).where(inArray(outboxEvents.id, ids));
    },

    async complete(id: string): Promise<void> {
      await db
        .update(outboxEvents)
        .set({ status: "done", processedAt: new Date(), lockedUntil: null, lastError: null })
        .where(eq(outboxEvents.id, id));
    },

    /** Schedule another try, or give up once the attempts are spent. */
    async fail(event: Pick<OutboxEvent, "id" | "attempts">, error: string): Promise<void> {
      const exhausted = event.attempts >= OUTBOX_MAX_ATTEMPTS;
      await db
        .update(outboxEvents)
        .set({
          status: exhausted ? "failed" : "pending",
          lastError: error.slice(0, 1_000),
          lockedUntil: null,
          availableAt: new Date(Date.now() + outboxBackoffMs(event.attempts)),
          processedAt: exhausted ? new Date() : null,
        })
        .where(eq(outboxEvents.id, event.id));
    },

    /** A person's hand-offs that are still retrying or have given up. */
    async listUnsettled(userId: string, limit = 20): Promise<OutboxEvent[]> {
      return db
        .select()
        .from(outboxEvents)
        .where(
          and(eq(outboxEvents.userId, userId), inArray(outboxEvents.status, ["pending", "failed"]))
        )
        .orderBy(desc(outboxEvents.createdAt))
        .limit(limit);
    },

    /** Try a given-up event again from scratch. */
    async retry(userId: string, id: string): Promise<boolean> {
      const rows = await db
        .update(outboxEvents)
        .set({ status: "pending", attempts: 0, availableAt: new Date(), lockedUntil: null })
        .where(
          and(
            eq(outboxEvents.id, id),
            eq(outboxEvents.userId, userId),
            eq(outboxEvents.status, "failed")
          )
        )
        .returning({ id: outboxEvents.id });
      return rows.length > 0;
    },
  };
}
