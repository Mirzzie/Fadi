import { and, count, desc, eq } from "drizzle-orm";

import type { Database } from "../client";
import { evidenceItems, type EvidenceItem, type NewEvidenceItem } from "../schema";

/**
 * The shared evidence pool — the user's real experience stored once, independent
 * of any single career track. Tracks rank/frame this pool differently; this repo
 * just owns the items.
 */
export function createEvidenceRepository(db: Database) {
  return {
    async listForUser(userId: string): Promise<EvidenceItem[]> {
      return db
        .select()
        .from(evidenceItems)
        .where(eq(evidenceItems.userId, userId))
        .orderBy(desc(evidenceItems.updatedAt));
    },

    /** The most recent change to the pool — powers report/output staleness. Cheap:
     *  one indexed row, not the whole pool. Null when the pool is empty. */
    async latestUpdatedAt(userId: string): Promise<Date | null> {
      const [row] = await db
        .select({ updatedAt: evidenceItems.updatedAt })
        .from(evidenceItems)
        .where(eq(evidenceItems.userId, userId))
        .orderBy(desc(evidenceItems.updatedAt))
        .limit(1);
      return row?.updatedAt ?? null;
    },

    async getForUser(userId: string, id: string): Promise<EvidenceItem | null> {
      const [row] = await db
        .select()
        .from(evidenceItems)
        .where(and(eq(evidenceItems.id, id), eq(evidenceItems.userId, userId)))
        .limit(1);
      return row ?? null;
    },

    async create(
      userId: string,
      input: Omit<NewEvidenceItem, "id" | "userId" | "createdAt" | "updatedAt">,
    ): Promise<EvidenceItem> {
      const [created] = await db.insert(evidenceItems).values({ ...input, userId }).returning();
      return created;
    },

    async createMany(
      userId: string,
      rows: Array<Omit<NewEvidenceItem, "id" | "userId" | "createdAt" | "updatedAt">>,
    ): Promise<EvidenceItem[]> {
      if (rows.length === 0) return [];
      return db
        .insert(evidenceItems)
        .values(rows.map((r) => ({ ...r, userId })))
        .returning();
    },

    async update(
      userId: string,
      id: string,
      patch: Partial<
        Pick<EvidenceItem, "kind" | "title" | "organization" | "period" | "detail" | "metrics" | "tags">
      >,
    ): Promise<EvidenceItem | null> {
      const [updated] = await db
        .update(evidenceItems)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(evidenceItems.id, id), eq(evidenceItems.userId, userId)))
        .returning();
      return updated ?? null;
    },

    async delete(userId: string, id: string): Promise<void> {
      await db.delete(evidenceItems).where(and(eq(evidenceItems.id, id), eq(evidenceItems.userId, userId)));
    },

    async count(userId: string): Promise<number> {
      // COUNT in the database, not in Node. The previous version selected every row's
      // id and took `.length` — transferring the whole pool over the wire to learn a
      // single integer. `interview-stories.repository` already did this correctly;
      // this one was the outlier.
      const [row] = await db
        .select({ value: count() })
        .from(evidenceItems)
        .where(eq(evidenceItems.userId, userId));
      return row?.value ?? 0;
    },
  };
}
