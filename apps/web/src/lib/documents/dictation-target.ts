/**
 * WHERE does dictated text go?
 *
 * The first version appended to the end of whichever field's mic was pressed, which is
 * why a stray capture appeared as a new bullet rather than editing an existing one.
 * "Append to the field" is not an editing model — it's a logging model.
 *
 * Rejected alternatives:
 *   - A mic per bullet: dozens of buttons, and it still can't target mid-sentence.
 *   - Spoken commands ("replace line two"): the user must now narrate coordinates,
 *     which is slower than typing and mis-hears catastrophically — the opposite of the
 *     point. It also means the transcript is no longer purely their content.
 *
 * So we use the model every editor already teaches: THE CARET IS THE TARGET.
 *   - Text selected  → dictation REPLACES the selection (rewrite this bullet).
 *   - Caret in text  → dictation is INSERTED at the caret (add mid-list).
 *   - Not focused    → dictation is APPENDED (capture something new).
 *
 * The user aims by clicking — a gesture they already know, that needs no explanation,
 * and that costs nothing when they don't use it. Pure function so the placement rules
 * are testable without a DOM.
 */

export type DictationTarget = {
  /** Current field contents. */
  value: string;
  /** Caret start, or null when the field isn't focused. */
  selectionStart: number | null;
  /** Caret end — equal to start when nothing is selected. */
  selectionEnd: number | null;
  /** Separator between existing content and appended content. */
  separator?: string;
};

export type DictationPlacement = {
  /** The field's new contents. */
  value: string;
  /** Where the caret should land afterwards (end of what was just inserted). */
  caret: number;
  mode: "replace" | "insert" | "append";
};

/**
 * Place dictated text relative to the caret.
 *
 * Never destroys existing content except where the user explicitly selected it —
 * selection IS the instruction to overwrite. Everything else only adds.
 */
export function placeDictation(text: string, target: DictationTarget): DictationPlacement {
  const dictated = text.trim();
  const { value, selectionStart, selectionEnd, separator = " " } = target;

  if (!dictated) return { value, caret: selectionEnd ?? value.length, mode: "append" };

  // Not focused → this is new content, not an edit.
  if (selectionStart === null || selectionEnd === null) {
    const joined = value.trim() ? `${value.replace(/\s+$/, "")}${separator}${dictated}` : dictated;
    return { value: joined, caret: joined.length, mode: "append" };
  }

  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);

  // Selection → replace exactly what they highlighted. This is "rewrite this bullet",
  // and it's the only path that removes anything the user wrote.
  if (start !== end) {
    const next = value.slice(0, start) + dictated + value.slice(end);
    return { value: next, caret: start + dictated.length, mode: "replace" };
  }

  // Caret at the very end of the field → same as appending.
  if (start >= value.trimEnd().length) {
    const joined = value.trim() ? `${value.replace(/\s+$/, "")}${separator}${dictated}` : dictated;
    return { value: joined, caret: joined.length, mode: "append" };
  }

  // Caret inside the text → insert there, keeping the surrounding words spaced.
  const before = value.slice(0, start);
  const after = value.slice(start);
  const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
  const needsTrailingSpace = after.length > 0 && !/^\s/.test(after);
  const insert = `${needsLeadingSpace ? " " : ""}${dictated}${needsTrailingSpace ? " " : ""}`;
  return { value: before + insert + after, caret: start + insert.length, mode: "insert" };
}
