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
 * WHAT THE REWRITE IS ALLOWED TO CHANGE.
 *
 * Codex's S2-R2: the guard treated every entry it did not already have as an invention, and put
 * back every entry the rewrite left out. That made two legitimate requests impossible — the two
 * Fadi itself offers. "Work in SOC home lab" added a project the person really has, and the guard
 * deleted it as invented; "Drop the retail job" removed it, and the guard restored it. A guard
 * that refuses the action the product suggests is not protecting anyone.
 *
 * So the guard is told what the RECORD supports (may be added) and what the person explicitly
 * asked to remove (may go). Everything else is unchanged: an entry that matches neither their
 * document nor their record is still an invention, and a silent omission is still restored.
 */
export type GuardScope = {
  /** Entries the person's own record supports — a rewrite may introduce these. */
  backed?: Entry[];
  /** Identities the instruction explicitly asked to remove. */
  removable?: string[];
};

/**
 * Put back anything the rewrite lost.
 *
 * Returns the merged list plus the identities restored, so the person can be told plainly rather
 * than discovering a missing job later — on the version they sent.
 */
export function restoreDropped<T extends Entry>(
  before: T[],
  after: T[],
  keys: readonly string[],
  scope: GuardScope = {}
): { entries: T[]; restored: string[]; invented: string[]; added: string[]; removed: string[] } {
  // A rewrite may reword an entry. It may not invent one. Live, the model renamed an employer to
  // a company from the person's OTHER résumé; the original was restored and the invention kept,
  // leaving a history that was never theirs. Anything the rewrite returns that matches nothing in
  // their record is dropped and named.
  const invented: string[] = [];
  const added: string[] = [];
  const kept = after.filter((entry) => {
    if (before.some((original) => sameEntry(original, entry, keys))) return true;
    // Not in the document, but in their record: this is the person's own work being worked in,
    // not a fabrication.
    if ((scope.backed ?? []).some((record) => sameEntry(record, entry, keys))) {
      added.push(identityOf(entry, keys) || "an entry without a title");
      return true;
    }
    invented.push(identityOf(entry, keys) || "an entry without a title");
    return false;
  });

  const removable = new Set((scope.removable ?? []).map((id) => id.toLowerCase()));
  const restored: string[] = [];
  const removed: string[] = [];
  const merged = [...kept];
  before.forEach((entry, index) => {
    if (kept.some((surviving) => sameEntry(entry, surviving, keys))) return;
    const id = identityOf(entry, keys) || "an entry without a title";
    if (removable.has(id.toLowerCase())) {
      // They asked for this one to go, by name. Removing it is the instruction, not a loss.
      removed.push(id);
      return;
    }
    restored.push(id);
    // Back where it was, as far as the shortened list allows.
    merged.splice(Math.min(index, merged.length), 0, entry);
  });

  return { entries: merged, restored, invented, added, removed };
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

/**
 * Which entries did the instruction explicitly ask to remove?
 *
 * Free text, so this is deliberately narrow: a removal verb AND the entry named. "Drop the
 * Deloitte role" removes that role; "make it shorter", "cut the fluff" and "trim the bullets"
 * remove nothing, because shortening prose is not deleting history. Anything this does not
 * recognise falls back to the safe behaviour — the entry is restored.
 */
const REMOVAL = /\b(drop|remove|delete|cut|take\s+out|get\s+rid\s+of|leave\s+out|omit)\b/i;

export function explicitRemovals<T extends Entry>(
  instruction: string,
  before: T[],
  keys: readonly string[]
): string[] {
  if (!REMOVAL.test(instruction)) return [];
  const asked = instruction.toLowerCase();
  const out: string[] = [];
  for (const entry of before) {
    const id = identityOf(entry, keys);
    if (!id) continue;
    // Each part on its own — "Deloitte · Analyst" is never typed that way, but "the Deloitte
    // job" and "the analyst role" both name it.
    const named = keys
      .map((key) => String(entry[key] ?? "").trim().toLowerCase())
      .filter((part) => part.length > 3)
      .some((part) => asked.includes(part));
    if (named) out.push(id);
  }
  return out;
}

/** What to say when the rewrite worked in something from their record. */
export function addedNote(added: string[]): string {
  if (added.length === 0) return "";
  const list = added.slice(0, 3).join(", ");
  const more = added.length > 3 ? ` and ${added.length - 3} more` : "";
  return `Fadi worked in ${list}${more} from your record.`;
}

/** What to say when the rewrite removed something because they asked for it by name. */
export function removedNote(removed: string[]): string {
  if (removed.length === 0) return "";
  const list = removed.slice(0, 3).join(", ");
  const more = removed.length > 3 ? ` and ${removed.length - 3} more` : "";
  return `Fadi removed ${list}${more}, as you asked. Your record still has ${removed.length === 1 ? "it" : "them"} — this only changes this document.`;
}
