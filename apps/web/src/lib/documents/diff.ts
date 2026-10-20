/**
 * What changed, line by line.
 *
 * A rewrite that lands in the editor with no account of what it touched asks the person to
 * re-read their whole CV to find out. Worse by voice: "I've rewritten it" tells someone who
 * cannot see the screen nothing at all about what they are agreeing to.
 *
 * Line-level on purpose. A CV is bullets and headings — whole lines are the unit people think
 * in, and a word-level diff of a rewritten sentence is noise dressed as precision.
 */

export type DiffRow =
  | { kind: "same"; text: string }
  | { kind: "added"; text: string }
  | { kind: "removed"; text: string };

export type DocumentDiff = {
  rows: DiffRow[];
  added: number;
  removed: number;
  /** One sentence, for reading aloud. */
  summary: string;
};

/**
 * The lines a PERSON would compare.
 *
 * A résumé is stored as JSON on one line, so diffing the raw text says "rewrote 1 line" and
 * shows a wall of braces — true, unreadable, and impossible to speak. This walks the structure
 * and emits the labelled text it actually contains, so a changed bullet reads as a changed
 * bullet. Anything that is not JSON is compared as it is written.
 */
export function readableLines(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return text.replace(/\r\n/g, "\n").split("\n");
  }
  try {
    return flatten(JSON.parse(trimmed), "");
  } catch {
    return text.replace(/\r\n/g, "\n").split("\n");
  }
}

/** Labelled leaf text, in document order. Empty values are dropped — they diff as noise. */
function flatten(value: unknown, path: string): string[] {
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => (path ? `${path}: ${line}` : line));
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return [`${path}: ${String(value)}`];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      flatten(item, path ? `${path} ${index + 1}` : String(index + 1))
    );
  }
  if (value && typeof value === "object") {
    return (
      Object.entries(value)
        // Ids change nothing a person can read, and make every rewrite look bigger than it is.
        .filter(([key]) => key !== "id")
        .flatMap(([key, child]) => flatten(child, path ? `${path} · ${label(key)}` : label(key)))
    );
  }
  return [];
}

function label(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

function lines(text: string): string[] {
  return readableLines(text);
}

/** Longest common subsequence over lines — small documents, so the simple table is fine. */
function lcs(a: string[], b: string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i]![j] =
        a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  return table;
}

export function diffDocuments(before: string, after: string): DocumentDiff {
  const a = lines(before);
  const b = lines(after);
  const table = lcs(a, b);

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      rows.push({ kind: "same", text: a[i]! });
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      rows.push({ kind: "removed", text: a[i]! });
      i += 1;
    } else {
      rows.push({ kind: "added", text: b[j]! });
      j += 1;
    }
  }
  while (i < a.length) rows.push({ kind: "removed", text: a[i++]! });
  while (j < b.length) rows.push({ kind: "added", text: b[j++]! });

  const added = rows.filter((row) => row.kind === "added" && row.text.trim()).length;
  const removed = rows.filter((row) => row.kind === "removed" && row.text.trim()).length;

  return { rows, added, removed, summary: describe(added, removed, a, b) };
}

function describe(added: number, removed: number, a: string[], b: string[]): string {
  if (added === 0 && removed === 0) return "Nothing changed.";

  const beforeLength = a.join("\n").length;
  const afterLength = b.join("\n").length;
  const both = added > 0 && removed > 0;
  if (both && added === removed) {
    // Only claim a direction when there is one. Equal lengths said "longer now", which is the
    // kind of small lie that costs trust in the one sentence someone hears before agreeing.
    const size =
      afterLength === beforeLength
        ? ""
        : afterLength < beforeLength
          ? ", and it's shorter now"
          : ", and it's longer now";
    return `Rewrote ${added} line${added === 1 ? "" : "s"}${size}.`;
  }
  const parts: string[] = [];
  if (added > 0) parts.push(`added ${added} line${added === 1 ? "" : "s"}`);
  if (removed > 0) parts.push(`took out ${removed} line${removed === 1 ? "" : "s"}`);
  return `I ${parts.join(" and ")}.`;
}

/** The changed lines only, for reading aloud — capped, because nobody listens to twelve. */
export function speakableDiff(diff: DocumentDiff, max = 3): string {
  // What it says NOW is what someone is agreeing to, so new lines are read first and removals
  // only fill the gap. Reading three deletions and none of the replacements told nobody
  // anything about the document they were about to keep.
  const changed = diff.rows.filter((row) => row.kind !== "same" && row.text.trim());
  if (changed.length === 0) return diff.summary;

  const additions = changed.filter((row) => row.kind === "added");
  const removals = changed.filter((row) => row.kind === "removed");
  const ordered = [...additions, ...removals];

  const spoken = ordered
    .slice(0, max)
    .map((row) => `${row.kind === "added" ? "Now reads" : "Took out"}: ${row.text.trim()}`)
    .join(". ");
  const rest = ordered.length - max;
  return `${diff.summary} ${spoken}${rest > 0 ? `. And ${rest} more change${rest === 1 ? "" : "s"}` : ""}.`;
}
