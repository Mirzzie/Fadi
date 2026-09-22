/**
 * A SAVED DOCUMENT DOES NOT KNOW THE WORLD MOVED.
 *
 * A résumé is generated from the evidence selected at that moment, and then it sits there. Finish
 * a lab project, correct an employer, accept a held import — the record changes and every
 * document written from it silently becomes last month's answer. The person finds out when a
 * recruiter asks about the thing that is missing.
 *
 * Generation already captures the exact material it used (Codex's context snapshot, its id and
 * fingerprint stored on the document). So freshness is a comparison, not a guess: the captured
 * fingerprint against the current one for the same scope. When they differ, this says WHAT
 * differs in the person's own terms, because "out of date" with no specifics is just anxiety.
 *
 * A document with no captured context — imported, pasted, written by hand — is `unknown`, and
 * says so. Guessing staleness for something Fadi never generated would be a claim about a
 * document it has never seen the inputs for.
 */

export type CapturedContext = {
  snapshotId: string | null;
  fingerprint: string | null;
  schemaVersion: number | null;
};

/** What the document recorded about the material it was written from. */
export function capturedContextOf(metadata: unknown): CapturedContext | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const snapshotId =
    typeof m.careerContextSnapshotId === "string" ? m.careerContextSnapshotId : null;
  const fingerprint =
    typeof m.careerContextFingerprint === "string" ? m.careerContextFingerprint : null;
  if (!snapshotId && !fingerprint) return null;
  return {
    snapshotId,
    fingerprint,
    schemaVersion: typeof m.contextSchemaVersion === "number" ? m.contextSchemaVersion : null,
  };
}

export type ContextRecord = {
  factId?: string | null;
  title?: string | null;
  organization?: string | null;
  detail?: string | null;
  period?: string | null;
  kind?: string | null;
  metrics?: string | null;
  attribution?: string | null;
  tags?: string[];
  marketTags?: string[];
};

export type RecordChanges = {
  /** Records the person has since added, and this document has never mentioned. */
  added: string[];
  /** Records this document was written from that are no longer in their selection. */
  removed: string[];
  /** Same record, different words — a correction the document is still showing the old side of. */
  reworded: string[];
};

/** How a record is recognised across two captures: its fact, or failing that what it is called. */
function identity(record: ContextRecord): string {
  if (record.factId) return `fact:${record.factId}`;
  return [record.title, record.organization]
    .map((part) => (part ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" · ");
}

/** What a reader would call the record. */
function name(record: ContextRecord): string {
  const title = (record.title ?? "").trim();
  const org = (record.organization ?? "").trim();
  if (title && org) return `${title} (${org})`;
  return title || org || "an untitled record";
}

function words(detail: string | null | undefined): string {
  return (detail ?? "").replace(/\s+/g, " ").trim();
}

/** The difference between the material a document was written from and the material now. */
export function whatChanged(before: ContextRecord[], after: ContextRecord[]): RecordChanges {
  const was = new Map(before.map((r) => [identity(r), r]));
  const now = new Map(after.map((r) => [identity(r), r]));

  const added: string[] = [];
  const reworded: string[] = [];
  for (const [key, record] of now) {
    const previous = was.get(key);
    if (!previous) {
      added.push(name(record));
      continue;
    }
    const fields = [
      "title",
      "organization",
      "detail",
      "period",
      "kind",
      "metrics",
      "attribution",
    ] as const;
    const changed = fields.some((field) => words(previous[field]) !== words(record[field]));
    const tags = (values?: string[]) => JSON.stringify([...new Set(values ?? [])].sort());
    if (
      changed ||
      tags(previous.tags) !== tags(record.tags) ||
      tags(previous.marketTags) !== tags(record.marketTags)
    ) {
      reworded.push(name(record));
    }
  }

  const removed: string[] = [];
  for (const [key, record] of was) if (!now.has(key)) removed.push(name(record));

  return { added, removed, reworded };
}

export function nothingChanged(changes: RecordChanges): boolean {
  return changes.added.length + changes.removed.length + changes.reworded.length === 0;
}

/** Name at most three, then count the rest — a list nobody reads is the same as no list. */
function list(names: string[]): string {
  const shown = names.slice(0, 3).join(", ");
  const rest = names.length - 3;
  return rest > 0 ? `${shown} and ${rest} more` : shown;
}

/**
 * What to tell the person, in their terms.
 *
 * Deliberately not "regenerate": the document may be exactly what they want, and a change in the
 * record is information, not an instruction. The sentence names what is different and stops.
 */
export function freshnessNote(changes: RecordChanges): string {
  const parts: string[] = [];
  if (changes.added.length) parts.push(`you've added ${list(changes.added)}`);
  if (changes.reworded.length) parts.push(`you updated ${list(changes.reworded)}`);
  if (changes.removed.length) parts.push(`${list(changes.removed)} is no longer selected`);
  if (parts.length === 0) return "Your record has changed since this was written.";
  const joined =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `Your record has changed since this was written — ${joined}.`;
}

/**
 * A ready-made instruction for the "Change it" box, so acting on this is one click through the
 * guarded rewrite (truth gate, nothing-deleted check, undo) rather than a fresh generation that
 * would throw away the person's edits.
 */
export function freshnessAsk(changes: RecordChanges): string | null {
  if (changes.added.length) return `Work in ${list(changes.added)}`;
  if (changes.reworded.length) return `Use my current wording for ${list(changes.reworded)}`;
  if (changes.removed.length) return `Drop ${list(changes.removed)}`;
  return null;
}

/**
 * Is this document still written from the person's current record?
 *
 * SCOPE, deliberately narrow (Codex's S2-R4): career records only. The captured fingerprint also
 * covers the job posting, the direction and contact details, so a fingerprint difference alone is
 * not reported — what the person is told about is their own material changing. `unknown` means
 * exactly that: a document Fadi did not generate is not proven current, it is unexamined.
 */
export type DocumentFreshness =
  | { state: "unknown" }
  | { state: "current" }
  | { state: "stale"; note: string; ask: string | null; changes: RecordChanges };
