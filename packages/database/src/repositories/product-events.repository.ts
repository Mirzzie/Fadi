import { and, desc, eq, gte, sql } from "drizzle-orm";

import type { DbOrTx } from "../client";
import { productEvents, type NewProductEvent, type ProductEvent } from "../schema";

/**
 * Append-only product events. First real consumer: portfolio visitor analytics.
 *
 * `userId` is the OWNER of the thing the event happened to, never the visitor —
 * public portfolio traffic is anonymous by construction, so there is no visitor
 * account to reference. That choice is what makes "show me who looked at MY site"
 * a plain indexed lookup.
 */
export function createProductEventsRepository(db: DbOrTx) {
  return {
    async record(event: NewProductEvent): Promise<void> {
      await db.insert(productEvents).values(event);
    },

    /** Raw events for one owner + entity, newest first. */
    async listForEntity(
      userId: string,
      entityId: string,
      opts: { since?: Date; limit?: number } = {}
    ): Promise<ProductEvent[]> {
      const where = [eq(productEvents.userId, userId), eq(productEvents.entityId, entityId)];
      if (opts.since) where.push(gte(productEvents.createdAt, opts.since));
      return db
        .select()
        .from(productEvents)
        .where(and(...where))
        .orderBy(desc(productEvents.createdAt))
        .limit(opts.limit ?? 500);
    },

    /**
     * Counts per event type for one entity since a date. Aggregated in SQL rather
     * than by loading rows, so a page that gets popular doesn't get slow.
     */
    async countsByType(
      userId: string,
      entityId: string,
      since: Date,
      /** Exclude the owner's own visits — they are not an audience. */
      excludeSelf = true
    ): Promise<{ eventType: string; total: number; visitors: number }[]> {
      const rows = await db
        .select({
          eventType: productEvents.eventType,
          total: sql<number>`count(*)::int`,
          // Distinct visitors, not hits: one person refreshing five times is one
          // person. The hash is the only visitor identifier stored (see analytics.ts).
          visitors: sql<number>`count(distinct (${productEvents.payload} ->> 'visitor'))::int`,
        })
        .from(productEvents)
        .where(
          and(
            eq(productEvents.userId, userId),
            eq(productEvents.entityId, entityId),
            gte(productEvents.createdAt, since),
            // Bots are not readers. looksAutomated() has flagged crawlers, uptime
            // monitors and curl since day one, but nothing ever filtered on the flag —
            // so "6 people looked at your work" counted search-engine spiders and the
            // author's own test requests. Inventing an audience is the one thing this
            // panel must never do.
            sql`(${productEvents.payload} ->> 'automated') is distinct from 'true'`,
            ...(excludeSelf ? [sql`(${productEvents.payload} ->> 'self') is distinct from 'true'`] : [])
          )
        )
        .groupBy(productEvents.eventType);
      return rows;
    },

    /**
     * Top values of one payload key for an event type — "which focus did visitors
     * declare?", "which piece of work got opened?". Field-neutral: the keys carry
     * whatever vocabulary the owner's own content uses.
     */
    async topPayloadValues(
      userId: string,
      entityId: string,
      eventType: string,
      key: string,
      since: Date,
      limit = 8
    ): Promise<{ value: string; total: number }[]> {
      return db
        .select({
          value: sql<string>`${productEvents.payload} ->> ${key}`,
          total: sql<number>`count(*)::int`,
        })
        .from(productEvents)
        .where(
          and(
            eq(productEvents.userId, userId),
            eq(productEvents.entityId, entityId),
            eq(productEvents.eventType, eventType),
            gte(productEvents.createdAt, since),
            sql`(${productEvents.payload} ->> 'self') is distinct from 'true'`,
            sql`(${productEvents.payload} ->> 'automated') is distinct from 'true'`,
            sql`${productEvents.payload} ->> ${key} is not null`
          )
        )
        // GROUP BY 1, not by a repeat of the expression.
        //
        // Drizzle emits a SEPARATE bind placeholder for each `${key}`, so
        // `payload ->> $1` in the select and `payload ->> $7` in the group-by are two
        // different expressions as far as Postgres is concerned, and it rejects the
        // whole statement with "must appear in the GROUP BY clause". The ordinal
        // refers to the selected expression itself, so they can never diverge.
        .groupBy(sql`1`)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);
    },
    /** Highest numeric value stored under one payload key — a resume cursor. */
    async maxPayloadNumber(userId: string, entityId: string, key: string): Promise<number> {
      const [row] = await db
        .select({ max: sql<number | null>`max((${productEvents.payload} ->> ${key})::bigint)` })
        .from(productEvents)
        .where(and(eq(productEvents.userId, userId), eq(productEvents.entityId, entityId)));
      return Number(row?.max ?? 0);
    },

    /**
     * Highest collector row id already imported — the resume cursor for the pull.
     * 0 when nothing has been imported yet, so the first pull starts at the beginning.
     */
    async maxCollectorId(userId: string, entityId: string): Promise<number> {
      const [row] = await db
        .select({ max: sql<number | null>`max((${productEvents.payload} ->> 'cid')::bigint)` })
        .from(productEvents)
        .where(and(eq(productEvents.userId, userId), eq(productEvents.entityId, entityId)));
      return Number(row?.max ?? 0);
    },

    /**
     * The owner's own visits. Shown separately so a working counter never looks
     * broken ("I opened it five times and it says zero") while still never being
     * mistaken for interest from someone else.
     */
    async countSelf(userId: string, entityId: string, since: Date): Promise<number> {
      const [row] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(productEvents)
        .where(
          and(
            eq(productEvents.userId, userId),
            eq(productEvents.entityId, entityId),
            gte(productEvents.createdAt, since),
            sql`(${productEvents.payload} ->> 'self') = 'true'`
          )
        );
      return row?.total ?? 0;
    },

    /**
     * THE LOG, not the totals.
     *
     * Counters answer "how many"; they cannot answer "was that real?" — which is the
     * question an owner actually asks when a number moves. This returns the events
     * themselves, newest first, INCLUDING the ones excluded from the counts, each still
     * carrying its own flags so the reader can see for themselves which is which.
     * Showing an excluded row is the opposite of counting it.
     */
    async recentEvents(
      userId: string,
      entityId: string,
      since: Date,
      limit = 100
    ): Promise<
      { id: string; eventType: string; createdAt: Date; payload: Record<string, unknown> }[]
    > {
      return db
        .select({
          id: productEvents.id,
          eventType: productEvents.eventType,
          createdAt: productEvents.createdAt,
          payload: productEvents.payload,
        })
        .from(productEvents)
        .where(
          and(
            eq(productEvents.userId, userId),
            eq(productEvents.entityId, entityId),
            gte(productEvents.createdAt, since)
          )
        )
        .orderBy(desc(productEvents.createdAt))
        .limit(limit) as Promise<
        { id: string; eventType: string; createdAt: Date; payload: Record<string, unknown> }[]
      >;
    },

    /**
     * Delete the owner's own visits and automated hits for one site.
     *
     * Testing a portfolio means visiting it, and a tool that makes you afraid to try
     * your own work is broken. These rows are already excluded from every number, so
     * this changes no statistic — it only clears the log of the noise the owner made
     * while checking the thing worked. Genuine visitor events are never touched.
     */
    async purgeExcluded(userId: string, entityId: string): Promise<number> {
      const rows = await db
        .delete(productEvents)
        .where(
          and(
            eq(productEvents.userId, userId),
            eq(productEvents.entityId, entityId),
            sql`((${productEvents.payload} ->> 'self') = 'true' or (${productEvents.payload} ->> 'automated') = 'true')`
          )
        )
        .returning({ id: productEvents.id });
      return rows.length;
    },

    /**
     * Crawlers, uptime monitors and scripted requests. Excluded from every count above
     * and reported here instead — hiding them would make a quiet week look like a broken
     * counter, and counting them would make a spider look like a reader.
     */
    async countAutomated(userId: string, entityId: string, since: Date): Promise<number> {
      const [row] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(productEvents)
        .where(
          and(
            eq(productEvents.userId, userId),
            eq(productEvents.entityId, entityId),
            gte(productEvents.createdAt, since),
            sql`(${productEvents.payload} ->> 'automated') = 'true'`,
            sql`(${productEvents.payload} ->> 'self') is distinct from 'true'`
          )
        );
      return row?.total ?? 0;
    },
  };
}
