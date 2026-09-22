import { and, count, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";

import type { DbOrTx } from "../client";
import { evidenceItems, portfolioItems, type EvidenceItem, type NewEvidenceItem } from "../schema";

import { recordCanonicalState, recordFactState } from "./fact-history";
import {
  forgetSelections,
  reconcileSelections,
  type SelectionReconcile,
} from "./selection-lifecycle";

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
        .where(
          and(
            eq(evidenceItems.userId, userId),
            eq(evidenceItems.isCanonical, true),
            eq(evidenceItems.reviewStatus, "accepted")
          )
        )
        .orderBy(desc(evidenceItems.updatedAt));
    },

    async getCanonicalForFact(userId: string, factId: string): Promise<EvidenceItem | null> {
      const [row] = await db
        .select()
        .from(evidenceItems)
        .where(
          and(
            eq(evidenceItems.userId, userId),
            eq(evidenceItems.isCanonical, true),
            eq(evidenceItems.reviewStatus, "accepted"),
            or(eq(evidenceItems.factId, factId), eq(evidenceItems.id, factId))
          )
        )
        .limit(1);
      return row ?? null;
    },

    /** Resolve a review without losing the candidate or forgetting the user's answer. */
    async keepSeparate(userId: string, id: string, otherId: string): Promise<void> {
      await db.transaction(async (tx) => {
        await tx.execute(sql`select id from users where id = ${userId} for update`);
        const rows = await tx
          .select()
          .from(evidenceItems)
          .where(and(eq(evidenceItems.userId, userId), inArray(evidenceItems.id, [id, otherId])));
        const item = rows.find((r) => r.id === id);
        const other = rows.find((r) => r.id === otherId);
        if (!item) throw new Error("Evidence item unavailable.");
        if (!other || id === otherId) {
          if (item.reviewStatus !== "pending") throw new Error("No review to resolve.");
          await tx
            .update(evidenceItems)
            .set({
              reviewStatus: "accepted",
              reviewTargetId: null,
              reviewReasons: [],
              updatedAt: new Date(),
            })
            .where(and(eq(evidenceItems.userId, userId), eq(evidenceItems.id, id)));
          // Accepting a held import is a state change: its history said "retracted" from the
          // moment it arrived, and stays wrong until this is written.
          await recordCanonicalState(tx, userId, item.factId ?? item.id);
          return;
        }
        for (const [row, counterpart] of [
          [item, other],
          [other, item],
        ]) {
          await tx
            .update(evidenceItems)
            .set({
              ...(row.id === id
                ? { reviewStatus: "accepted", reviewTargetId: null, reviewReasons: [] }
                : {}),
              distinctFrom: [
                ...new Set([...(row.distinctFrom ?? []), counterpart.factId ?? counterpart.id]),
              ],
              updatedAt: new Date(),
            })
            .where(and(eq(evidenceItems.userId, userId), eq(evidenceItems.id, row.id)));
        }
        // Both facts changed: one was accepted, and each now says it is not the other.
        await recordCanonicalState(tx, userId, item.factId ?? item.id);
        await recordCanonicalState(tx, userId, other.factId ?? other.id);
      });
    },

    /** Remove only an unresolved import; a stale button cannot delete accepted work. */
    async discardPending(userId: string, id: string): Promise<boolean> {
      return db.transaction(async (tx) => {
        const removed = await tx
          .delete(evidenceItems)
          .where(
            and(
              eq(evidenceItems.userId, userId),
              eq(evidenceItems.id, id),
              eq(evidenceItems.reviewStatus, "pending")
            )
          )
          .returning();
        const discarded = removed[0];
        if (!discarded) return false;
        // The import is gone from the pool, but it DID arrive. History keeps what it said and
        // that the person discarded it, so the same text arriving again is recognisable.
        await recordCanonicalState(tx, userId, discarded.factId ?? discarded.id, discarded);
        return true;
      });
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
            eq(evidenceItems.isCanonical, false)
          )
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
    /**
     * Fold one record into another as an alternative wording of the same fact.
     *
     * THE INVARIANT: exactly one canonical row per fact. Not at most one — exactly one.
     * A fact with none is worse than a duplicate, because every surface that projects
     * from the pool silently loses the record entirely.
     *
     * Two ways the previous version broke it, both found by Codex (D01, D02):
     *
     *   D01 — a freshly created row has `fact_id` NULL, so demoting "everything whose
     *         fact_id equals the absorbed row's fact" never matched the absorbed row
     *         itself. It stayed canonical, and the merge produced two.
     *   D02 — when both rows already shared a fact, that same demotion ran AFTER the
     *         promotion and demoted the keeper along with everything else, leaving the
     *         fact with no canonical row at all.
     *
     * Fixed by making the demotion explicitly exclude the keeper and explicitly include
     * the absorbed row by id, and by doing the whole thing in one transaction so a
     * failure between the two writes cannot leave the invariant broken.
     */
    async mergeInto(
      userId: string,
      canonicalId: string,
      absorbedId: string
    ): Promise<SelectionReconcile> {
      if (canonicalId === absorbedId) return { cleared: [], moved: [] };
      return db.transaction(async (tx) => {
        await tx.execute(sql`select id from users where id = ${userId} for update`);
        const rows = await tx
          .select()
          .from(evidenceItems)
          .where(
            and(
              eq(evidenceItems.userId, userId),
              inArray(evidenceItems.id, [canonicalId, absorbedId])
            )
          );
        const canonical = rows.find((r) => r.id === canonicalId);
        const absorbed = rows.find((r) => r.id === absorbedId);
        if (!canonical || !absorbed) throw new Error("Evidence item unavailable.");
        if (canonical.kind !== absorbed.kind)
          throw new Error("Different kinds of evidence cannot be merged.");
        if (canonical.reviewStatus !== "accepted")
          throw new Error("Choose an accepted record to keep.");

        const factId = canonical.factId ?? canonical.id;
        const absorbedFact = absorbed.factId ?? absorbed.id;

        // Demote FIRST, and never the keeper. Ordering matters: promoting first and then
        // demoting by fact is what erased the keeper when both already shared a fact.
        await tx
          .update(evidenceItems)
          .set({
            factId,
            isCanonical: false,
            reviewStatus: "accepted",
            reviewTargetId: null,
            reviewReasons: [],
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(evidenceItems.userId, userId),
              ne(evidenceItems.id, canonicalId),
              // The absorbed row by id — because its own fact_id may still be NULL —
              // and anything already merged into it.
              or(
                eq(evidenceItems.id, absorbedId),
                eq(evidenceItems.factId, absorbedFact),
                eq(evidenceItems.factId, factId)
              )
            )
          );

        await tx
          .update(evidenceItems)
          .set({ factId, isCanonical: true, updatedAt: new Date() })
          .where(and(eq(evidenceItems.userId, userId), eq(evidenceItems.id, canonicalId)));

        // Two histories move here. The keeper's fact now carries the absorbed wording, and the
        // absorbed fact stops standing on its own — recorded as a retraction of what it said,
        // never as a deletion of the fact that it was once counted separately.
        await recordCanonicalState(tx, userId, factId);
        if (absorbedFact !== factId) {
          await recordFactState(tx, userId, absorbed, "retracted");
        }

        // The person's Include/Exclude choices were made about two records; one of those records
        // no longer exists as an identity (S2-R5).
        return reconcileSelections(tx, userId, factId, absorbedFact);
      });
    },

    /** Undo a merge: the row becomes its own fact again. */
    async splitOut(userId: string, id: string): Promise<void> {
      await db.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(evidenceItems)
          .where(and(eq(evidenceItems.userId, userId), eq(evidenceItems.id, id)))
          .limit(1);
        if (!before) return;
        const [split] = await tx
          .update(evidenceItems)
          .set({ factId: id, isCanonical: true, updatedAt: new Date() })
          .where(and(eq(evidenceItems.userId, userId), eq(evidenceItems.id, id)))
          .returning();

        // Undoing a merge changes two facts: the one that was left, and the one that now exists
        // again on its own.
        await recordFactState(tx, userId, split, "active");
        const parent = before.factId ?? before.id;
        if (parent !== id) await recordCanonicalState(tx, userId, parent, before);
      });
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
      input: Omit<NewEvidenceItem, "userId" | "createdAt" | "updatedAt">
    ): Promise<EvidenceItem> {
      const [created] = await db
        .insert(evidenceItems)
        .values({ ...input, userId })
        .returning();
      return created;
    },

    async createMany(
      userId: string,
      rows: Array<Omit<NewEvidenceItem, "id" | "userId" | "createdAt" | "updatedAt">>
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
          | "attribution"
          | "reviewStatus"
          | "reviewTargetId"
          | "reviewReasons"
          | "distinctFrom"
        >
      >
    ): Promise<EvidenceItem | null> {
      return db.transaction(async (tx) => {
        const [updated] = await tx
          .update(evidenceItems)
          .set({ ...patch, updatedAt: new Date() })
          .where(and(eq(evidenceItems.id, id), eq(evidenceItems.userId, userId)))
          .returning();
        if (!updated) return null;
        // A correction IS a version. Which words the fact now leads with is read back from the
        // pool, so editing a rendering does not overwrite the fact's history with it.
        await recordCanonicalState(tx, userId, updated.factId ?? updated.id, updated);
        return updated;
      });
    },

    async delete(userId: string, id: string): Promise<void> {
      await db.transaction(async (tx) => {
        // Stamp the live portfolio items this record was standing on, BEFORE the row goes: the
        // foreign key nulls their link on delete, and afterwards a published claim the person
        // deliberately removed is indistinguishable from one they wrote by hand.
        await tx
          .update(portfolioItems)
          .set({ unbackedSince: new Date() })
          .where(
            and(
              eq(portfolioItems.userId, userId),
              eq(portfolioItems.evidenceItemId, id),
              eq(portfolioItems.isPublished, true),
              isNull(portfolioItems.unbackedSince)
            )
          );
        const [removed] = await tx
          .delete(evidenceItems)
          .where(and(eq(evidenceItems.id, id), eq(evidenceItems.userId, userId)))
          .returning();
        if (!removed) return;
        // Deleting the last row of a fact ends its history with what it last said; deleting one
        // wording of a fact that still has a leader records the fact as it now stands.
        const factId = removed.factId ?? removed.id;
        await recordCanonicalState(tx, userId, factId, removed);

        // A choice about a record that no longer exists is an orphan. If another wording still
        // leads the fact, the choice still means something and stays.
        const [survivor] = await tx
          .select({ id: evidenceItems.id })
          .from(evidenceItems)
          .where(and(eq(evidenceItems.userId, userId), eq(evidenceItems.factId, factId)))
          .limit(1);
        if (!survivor) await forgetSelections(tx, userId, factId);
      });
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
