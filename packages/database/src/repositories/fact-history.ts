import { and, eq, or } from "drizzle-orm";

import type { DbOrTx } from "../client";
import { evidenceItems, type CareerRecordSnapshot, type EvidenceItem } from "../schema";

import { createCareerCoreRepository } from "./career-core.repository";

/**
 * EVERY CHANGE TO A FACT IS A VERSION — NOT ONLY THE FIRST.
 *
 * Stage 1 recorded a version when evidence was admitted, and nowhere else. Codex read it and
 * named the hole: an edit, a merge, a keep-separate, an accepted review or a deletion changed
 * what the record SAYS without appending anything, so a pending import stayed "retracted" in
 * history after the person accepted it, and `currentFactVersion` could not be trusted as the
 * state of anything.
 *
 * These helpers are that missing write, and they live in the repository rather than in an action
 * so a future caller — a background agent, the extension, an import route — cannot forget them.
 *
 * They are called INSIDE the caller's transaction on purpose. History that is written
 * best-effort is history that quietly goes missing exactly when something went wrong; if the
 * record of a change cannot be written, the change itself does not happen.
 */

export function snapshotOf(row: EvidenceItem): CareerRecordSnapshot {
  return {
    evidenceItemId: row.id,
    kind: row.kind,
    title: row.title,
    organization: row.organization,
    period: row.period,
    detail: row.detail,
    metrics: row.metrics,
    tags: row.tags ?? [],
    origin: row.origin,
  };
}

/** Append this row's state to its fact's history. */
export async function recordFactState(
  db: DbOrTx,
  userId: string,
  row: EvidenceItem,
  status: "active" | "retracted" = row.reviewStatus === "pending" ? "retracted" : "active"
): Promise<void> {
  await createCareerCoreRepository(db as never).recordFactVersion(userId, {
    factId: row.factId ?? row.id,
    status,
    snapshot: snapshotOf(row),
  });
}

/**
 * Append what the fact says NOW, after a change to any of its rows.
 *
 * The state of a fact is whichever accepted row leads it, not the row that happened to be
 * edited — relabelling a rendering must not rewrite the fact's history with the rendering's
 * words. When nothing leads it any more (the last row was deleted, or it is still awaiting
 * review), `gone` is recorded as a retraction so the history ends with what it last said
 * instead of stopping mid-sentence.
 */
export async function recordCanonicalState(
  db: DbOrTx,
  userId: string,
  factId: string,
  gone?: EvidenceItem
): Promise<void> {
  const [leader] = await db
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

  if (leader) {
    await recordFactState(db, userId, leader, "active");
    return;
  }
  if (gone) await recordFactState(db, userId, gone, "retracted");
}
