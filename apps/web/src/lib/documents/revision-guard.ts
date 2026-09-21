/**
 * A REWRITE MAY REWORD HISTORY. IT MAY NOT DELETE IT.
 *
 * Measured on the owner's real résumé, 20 Sep 2026: asked to "lead with the Linux and cloud
 * work", the model reordered the experience — and dropped an entire employer, their most recent
 * role, without a word. Prompting against it is not a control: a model that omits an entry
 * produces a perfectly valid document, so nothing downstream can tell the difference.
 *
 * So the check is structural. Entries present before the rewrite must still be there afterwards;
 * any that are missing are put back, keeping the rewrite's order for everything it did return.
 * Removing a role stays something the person does deliberately, in the editor.
 */

export type Entry = Record<string, unknown>;

/** How an entry is recognised across a rewrite: the two fields a person would call it by. */
function identityOf(entry: Entry, keys: readonly string[]): string {
  return keys
    .map((key) => String(entry[key] ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" · ");
}

/**
 * The comparable form of one field.
 *
 * A rewrite tidies names — "Crozaint Technologies Pvt Ltd, India" comes back as "Crozaint
 * Technologies Pvt Ltd". Comparing the raw strings made that look like a deletion plus a new
 * job, and the résumé came back with six roles where the person has three (measured 21 Sep).
 */
function normalise(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[.,()]/g, " ")
    .replace(/\b(pvt|ltd|limited|inc|llc|plc|gmbh|solutions|technologies|group)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same entry, allowing for tidied punctuation, a dropped country, or a shortened legal name. */
function sameEntry(a: Entry, b: Entry, keys: readonly string[]): boolean {
  const [first, second] = keys;
  const titleA = normalise(a[second ?? first]);
  const titleB = normalise(b[second ?? first]);
  if (titleA && titleB && titleA !== titleB) return false;
  const orgA = normalise(a[first]);
  const orgB = normalise(b[first]);
  if (!orgA || !orgB) return Boolean(titleA) && titleA === titleB;
  return orgA === orgB || orgA.includes(orgB) || orgB.includes(orgA);
}

/**
 * Put back anything the rewrite lost.
 *
 * Returns the merged list plus the identities restored, so the person can be told plainly rather
 * than discovering a missing job later — on the version they sent.
 */
export function restoreDropped<T extends Entry>(
  before: T[],
  after: T[],
  keys: readonly string[]
): { entries: T[]; restored: string[]; invented: string[] } {
  // A rewrite may reword an entry. It may not invent one. Live, the model renamed an employer to
  // a company from the person's OTHER résumé; the original was restored and the invention kept,
  // leaving a history that was never theirs. Anything the rewrite returns that matches nothing in
  // their record is dropped and named.
  const invented: string[] = [];
  const kept = after.filter((entry) => {
    if (before.some((original) => sameEntry(original, entry, keys))) return true;
    invented.push(identityOf(entry, keys) || "an entry without a title");
    return false;
  });

  const restored: string[] = [];
  const merged = [...kept];
  before.forEach((entry, index) => {
    if (kept.some((surviving) => sameEntry(entry, surviving, keys))) return;
    restored.push(identityOf(entry, keys) || "an entry without a title");
    // Back where it was, as far as the shortened list allows.
    merged.splice(Math.min(index, merged.length), 0, entry);
  });

  return { entries: merged, restored, invented };
}

/** What to say when a rewrite tried to add history that is not theirs. */
export function inventedNote(invented: string[]): string {
  if (invented.length === 0) return "";
  const list = invented.slice(0, 3).join(", ");
  return `Fadi removed ${list}${invented.length > 3 ? ` and ${invented.length - 3} more` : ""} — that isn't in your record, and a rewrite can't add to your history.`;
}

/** What to say when history was put back. Plain, and never silent. */
export function restoredNote(restored: string[]): string {
  if (restored.length === 0) return "";
  const list = restored.slice(0, 3).join(", ");
  const more = restored.length > 3 ? ` and ${restored.length - 3} more` : "";
  return `Fadi kept ${list}${more} — a rewrite doesn't remove anything from your history. Delete it yourself if you meant to.`;
}
