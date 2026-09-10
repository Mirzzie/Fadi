import { and, count, desc, eq } from "drizzle-orm";

import type { DbOrTx } from "../client";
import { evidenceItems, type EvidenceItem, type NewEvidenceItem } from "../schema";

/**
 * The shared evidence pool — the user's real experience stored once, independent
 * of any single career track. Tracks rank/frame this pool differently; this repo
 * just owns the items.
 */
export function createEvidenceRepository(db: DbOrTx) {
  return {
    /**
     * The user's FACTS — one row per real thing.
     *
     * Canonical-only by default, and deliberately so: every caller (ranking, the
     * résumé, the portfolio projection, the AI prompt block) wants distinct realities,
     * not every wording of them. Returning renderings here is what let one tailored
     * rewrite look like a second project everywhere at once.
     */
    async listForUser(userId: string): Promise<EvidenceItem[]> {
      return db
        .select()
        .from(evidenceItems)
        .where(and(eq(evidenceItems.userId, userId), eq(evidenceItems.isCanonical, true)))
        .orderBy(desc(evidenceItems.updatedAt));
    },

    /** Every row including alternative wordings — for the merge UI and for export. */
    async listAllForUser(userId: string): Promise<EvidenceItem[]> {
      return db
        .select()
        .from(evidenceItems)
        .where(eq(evidenceItems.userId, userId))
        .orderBy(desc(evidenceItems.updatedAt));
    },

    /** The other wordings of one fact. */
    async listRenderings(userId: string, factId: string): Promise<EvidenceItem[]> {
      return db
        .select()
        .from(evidenceItems)
        .where(
          and(
            eq(evidenceItems.userId, userId),
            eq(evidenceItems.factId, factId),
            eq(evidenceItems.isCanonical, false),
          ),
        )
        .orderBy(desc(evidenceItems.updatedAt));
    },

    /**
     * Two records are the same real thing: fold one into the other.
     *
     * NOT a delete. The absorbed row keeps its wording and becomes a rendering of the
     * surviving fact, so a phrase written for a security application is still there
     * when that application comes round again. Merges are transitive — anything
     * already pointing at the absorbed row follows it to the new fact, so a chain of
     * merges can never strand a record behind a non-canonical parent.
     */
    async mergeInto(userId: string, canonicalId: string, absorbedId: string): Promise<void> {
      const [canonical] = await db
        .select()
        .from(evidenceItems)
        .where(and(eq(evidenceItems.userId, userId), eq(evidenceItems.id, canonicalId)))
        .limit(1);
      const [absorbed] = await db
        .select()
        .from(evidenceItems)
        .where(and(eq(evidenceItems.userId, userId), eq(evidenceItems.id, absorbedId)))
        .limit(1);
      if (!canonical || !absorbed || canonicalId === absorbedId) return;

      const factId = canonical.factId ?? canonical.id;
      await db
        .update(evidenceItems)
        .set({ factId, isCanonical: true, updatedAt: new Date() })
        .where(and(eq(evidenceItems.userId, userId), eq(evidenceItems.id, canonicalId)));

      // The absorbed row AND anything that had already been merged into it.
      await db
        .update(evidenceItems)
        .set({ factId, isCanonical: false, updatedAt: new Date() })
        .where(
          and(
            eq(evidenceItems.userId, userId),
            eq(evidenceItems.factId, absorbed.factId ?? absorbed.id),
          ),
        );
    },

    /** Undo a merge: the row becomes its own fact again. */
    async splitOut(userId: string, id: string): Promise<void> {
      await db
        .update(evidenceItems)
        .set({ factId: id, isCanonical: true, updatedAt: new Date() })
        .where(and(eq(evidenceItems.userId, userId), eq(evidenceItems.id, id)));
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
        Pick<
          EvidenceItem,
          | "kind"
          | "title"
          | "organization"
          | "period"
          | "detail"
          | "metrics"
          | "tags"
          | "marketTags"
          // Fact identity: which reality this row belongs to, whether it is the wording
          // that leads, and the audience it was written for.
          | "factId"
          | "isCanonical"
          | "renderingFor"
        >
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
