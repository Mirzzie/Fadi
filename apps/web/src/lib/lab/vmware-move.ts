/**
 * MOVING A VM IS SEVERAL SYSTEMS, SO IT KEEPS A JOURNAL (Codex scan P1, 15 Oct 2026).
 *
 * A move copies the machine's folder, edits the copy, repoints VMware's library and then Fadi's
 * record. No transaction spans a disk, VMware and PostgreSQL, so each finished phase is written
 * to `.fadi-move.json` in the copy. A move asked again reads it and carries on from there: a copy
 * cut short is discarded and made again (it is Fadi's own, half-made folder), a finished copy is
 * never made twice, and a library that couldn't be updated is retried rather than forgotten.
 * Pure: what to do, decided from what is on disk.
 */

export const MOVE_JOURNAL = ".fadi-move.json";

export type MovePhase =
  /** The folder exists and the copy has started. */
  | "copying"
  /** Every file is there, at full size. */
  | "copied"
  /** The copy's settings say "keep this machine's identity". */
  | "prepared"
  /** VMware's library points at the copy (or never listed the original). */
  | "listed"
  /** Fadi's own record points at the copy. */
  | "done";

export type MoveJournal = {
  version: 1;
  /** The original machine's folder. */
  source: string;
  phase: MovePhase;
  startedAt: string;
  updatedAt: string;
  inventory?: "updated" | "not-listed" | "no-library";
};

export type MoveDecision =
  /** Nothing there yet: copy. */
  | { kind: "fresh" }
  /** Fadi's own copy, cut short: delete it, then copy again. */
  | { kind: "discard-partial" }
  /** Fadi's own copy, complete: carry on from the next unfinished phase. */
  | { kind: "continue"; from: MovePhase }
  /** A folder that isn't Fadi's copy of this machine: never touch it. */
  | { kind: "refuse"; reason: string };

export function moveDecision(input: {
  targetExists: boolean;
  journal: MoveJournal | null;
  sourceDir: string;
  targetDir: string;
}): MoveDecision {
  if (!input.targetExists) return { kind: "fresh" };
  if (!input.journal) {
    return {
      kind: "refuse",
      reason: `${input.targetDir} already exists and isn't a copy Fadi made. Remove or rename it first.`,
    };
  }
  if (input.journal.source !== input.sourceDir) {
    return {
      kind: "refuse",
      reason: `${input.targetDir} holds Fadi's copy of a different machine (${input.journal.source}).`,
    };
  }
  if (input.journal.phase === "copying") return { kind: "discard-partial" };
  return { kind: "continue", from: input.journal.phase };
}

const ORDER: MovePhase[] = ["copying", "copied", "prepared", "listed", "done"];

/** Has the journal already got past this phase? */
export function reached(journal: Pick<MoveJournal, "phase">, phase: MovePhase): boolean {
  return ORDER.indexOf(journal.phase) >= ORDER.indexOf(phase);
}
