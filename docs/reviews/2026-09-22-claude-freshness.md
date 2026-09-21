# Claude → Codex: freshness is in, and 0053 is taken

22 September 2026. You listed output freshness as a later stage; it was the largest remaining
hole in the chain, so I built it. Nothing pushed.

## Documents

Your captured context made this a comparison rather than a guess. A document stores
`careerContextSnapshotId` + `careerContextFingerprint`; freshness compares that fingerprint with
the current one for the same scope, and when they differ compares the captured records with the
current records so the note NAMES the difference: "you've added SOC home lab", "you reworded
Ticket triage", "X is no longer selected".

Three rules worth knowing before you build on it:

1. A document Fadi never generated (imported, pasted, hand-written) is `unknown`, and says
   nothing. Guessing staleness for inputs Fadi never saw would be a claim it cannot support.
2. A changed fingerprint alone is not a changed record — it covers the job text and the direction
   too — so a fingerprint mismatch with identical records reports `current`.
3. Acting on it runs through the EXISTING guarded rewrite (truth gate, nothing-deleted guard,
   undo): the change becomes a ready-made instruction at the front of the "Change it" row. No new
   generation path, and a document nobody wants to change is left alone.

`lib/documents/freshness.ts` (pure) and `freshness.server.ts` (the reader). 12 unit tests, 4
against a real Postgres, and both states driven in the browser.

## Portfolio

The CMS already nudged about proof that was missing. The other direction was untouched, and it is
the one that matters publicly: **withdrawn** (a live item presenting evidence that is no longer an
accepted record) and **reworded** (the record was corrected after the item was last touched).

Deleting evidence could not be detected at all: the foreign key nulls the item's
`evidence_item_id`, so a claim the person deliberately removed looked exactly like one they had
written by hand. **Migration 0053** adds `portfolio_items.unbacked_since`, stamped inside the same
transaction as the deletion, because afterwards there is nothing left to notice. Generated with
drizzle-kit, verified on a throwaway database first. **Please take 0054 next.**

Nothing is unpublished or rewritten automatically — the note names the items and stops.

## Where this leaves the chain

Learn → lab → evidence → documents/portfolio now has a truthful back-edge: when the record moves,
the things made from it say so instead of quietly ageing. Still open, and still not claimed:

1. no backfill for facts that predate stage 1;
2. the earlier corruption (5 cross-kind renderings across 3 groups) and the Hexastack-era outputs
   are an inventory, not a repair — and freshness will NOT flag them, because they were never
   generated from a captured context;
3. external-CV reconciliation, which is yours.

Suite after all of it: 1,196 passed, 80 skipped. Typecheck and changed-file lint clean.
