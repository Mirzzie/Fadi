/**
 * Fadi's answers, shaped to be heard rather than read.
 *
 * Buddy speaks through a small speaker to someone who may not be looking at a screen. Markdown,
 * bullet lists and URLs read aloud are noise ("asterisk asterisk", "h t t p s"), and a long answer
 * is lost before it ends. So a voice answer keeps the sentences, drops the markup and stops at a
 * sentence boundary near sixty words — what Buddy's own measurements found a listener can hold.
 * Pure, so what is said is pinned by tests.
 */

export const SPOKEN_WORD_LIMIT = 60;

export function toSpeech(text: string, maxWords = SPOKEN_WORD_LIMIT): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [label](url) → label
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // headings
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/gm, (_, item: string) =>
      /[.!?]$/.test(item.trim()) ? item.trim() : `${item.trim()}.`
    ) // list items become sentences
    .replace(/[*_`~>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const words = plain.split(" ").filter(Boolean);
  if (words.length <= maxWords) return plain;

  // Stop at the last sentence end inside the limit; never mid-sentence unless there is none.
  const head = words.slice(0, maxWords).join(" ");
  const end = Math.max(head.lastIndexOf(". "), head.lastIndexOf("? "), head.lastIndexOf("! "));
  return end > 0 ? head.slice(0, end + 1) : `${head}…`;
}

/** A held change, said back plainly: what Fadi will do, with the details it will use. */
export function readBack(tool: string, args: Record<string, unknown>): string {
  const action = tool.replace(/_/g, " ");
  const details = Object.entries(args)
    // Models fill unknown arguments with the word "null"; that is not a detail worth reading out.
    .filter(
      ([, value]) =>
        ["string", "number", "boolean"].includes(typeof value) &&
        !["", "null", "undefined", "none"].includes(String(value).trim().toLowerCase())
    )
    .slice(0, 4)
    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value).slice(0, 80)}`)
    .join(", ");
  return details ? `${action} — ${details}` : action;
}

/** "A", "A and B", "A, B and C" — how a list is said rather than shown. */
export function spokenList(items: string[]): string {
  const said = items.map((item) => item.trim()).filter(Boolean);
  if (said.length <= 1) return said[0] ?? "";
  return `${said.slice(0, -1).join(", ")} and ${said[said.length - 1]}`;
}

/** "1 role", "3 roles" — never "role(s)". */
export function count(n: number, noun: string, plural = `${noun}s`): string {
  return `${n} ${n === 1 ? noun : plural}`;
}

/** A score as it is said: "3.5 out of 5", not "3.5/5". Whole numbers lose the ".0". */
export function outOf(value: number, max: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} out of ${max}`;
}

/** The first sentence of a message, for when the rest is detail a listener does not need. */
export function firstSentence(text: string): string {
  const match = text.trim().match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : text).trim();
}
