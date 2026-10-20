import { and, eq, inArray } from "drizzle-orm";

import type { DbOrTx } from "../client";
import { careerSelections } from "../schema";

/**
 * A CHOICE WAS MADE ABOUT A RECORD. WHEN THE RECORD CHANGES IDENTITY, THE CHOICE CANNOT JUST
 * FOLLOW IT.
 *
 * Codex's S2-R5. Include/Exclude choices are keyed by fact id. Merging two records leaves one of
 * those ids standing for nothing, so its choices become orphans — and if the two records were
 * decided differently ("always include this one", "never include that one"), transferring either
 * choice invents a decision the person never made about the merged record.
 *
 * So: a choice with nothing to conflict with moves; two choices that disagree are both cleared,
 * and the record goes back to Auto until the person decides again. Clearing is visible in the
 * panel and reported by the action; a silently transferred exclusion would not be.
 */

export type SelectionReconcile = {
  /** Scopes where the two records had been decided differently, so both choices were cleared. */
  cleared: string[];
  /** Scopes where the absorbed record's choice carried over unopposed. */
  moved: string[];
};

/** Fold one fact's selections into another after a merge. */
export async function reconcileSelections(
  db: DbOrTx,
  userId: string,
  keptFactId: string,
  absorbedFactId: string
): Promise<SelectionReconcile> {
  if (keptFactId === absorbedFactId) return { cleared: [], moved: [] };

  const rows = await db
    .select()
    .from(careerSelections)
    .where(
      and(
        eq(careerSelections.userId, userId),
        inArray(careerSelections.factId, [keptFactId, absorbedFactId])
      )
    );

  const cleared: string[] = [];
  const moved: string[] = [];
  const scopes = new Set(rows.map((row) => row.scope));

  for (const scope of scopes) {
    const kept = rows.find((r) => r.scope === scope && r.factId === keptFactId);
    const absorbed = rows.find((r) => r.scope === scope && r.factId === absorbedFactId);
    if (!absorbed) continue;

    const drop = async (factId: string) => {
      await db
        .delete(careerSelections)
        .where(
          and(
            eq(careerSelections.userId, userId),
            eq(careerSelections.scope, scope),
            eq(careerSelections.factId, factId)
          )
        );
    };

    if (!kept) {
      // Nothing to disagree with: the decision was about this work, and this work continues.
      await db
        .update(careerSelections)
        .set({ factId: keptFactId, updatedAt: new Date() })
        .where(
          and(
            eq(careerSelections.userId, userId),
            eq(careerSelections.scope, scope),
            eq(careerSelections.factId, absorbedFactId)
          )
        );
      moved.push(scope);
      continue;
    }

    if (kept.mode !== absorbed.mode) {
      // Two different decisions about what is now one record. Neither is the person's decision
      // about the merged record, so both go and the record falls back to Auto.
      await drop(keptFactId);
      await drop(absorbedFactId);
      cleared.push(scope);
      continue;
    }

    // Same decision on both sides: keep the surviving row, discard the duplicate.
    await drop(absorbedFactId);
  }

  return { cleared, moved };
}

/** Remove choices about a fact that no longer exists. */
export async function forgetSelections(
  db: DbOrTx,
  userId: string,
  factId: string
): Promise<number> {
  const removed = await db
    .delete(careerSelections)
    .where(and(eq(careerSelections.userId, userId), eq(careerSelections.factId, factId)))
    .returning({ id: careerSelections.id });
  return removed.length;
}
