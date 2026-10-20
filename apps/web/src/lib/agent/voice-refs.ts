/**
 * "Save the second one."
 *
 * On a screen the person points; by voice they count. After Fadi reads out a list — roles,
 * documents, flagships, projects — that list, in the order it was said, is kept for the
 * conversation, and an argument that is only a position ("the second one", "number 2", "the
 * last one") is replaced by the name at that position before anything is looked up or held.
 *
 * Only a bare position is replaced. "The second Stripe role" is a name and goes to the matcher
 * as said, so this can never turn a real name into a different record. Pure, so it is pinned by
 * tests.
 */

export type VoiceRef = { label: string };

type Item = Record<string, unknown>;
const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** The list a tool result read out, in order — or null when it read out no list. */
export function refsFrom(data: unknown): VoiceRef[] | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const list = (key: string, label: (item: Item) => string) =>
    Array.isArray(d[key])
      ? (d[key] as Item[]).map((item) => ({ label: label(item) })).filter((ref) => ref.label)
      : null;
  const refs =
    list("jobs", (j) =>
      str(j.title) && str(j.company) ? `${str(j.title)} at ${str(j.company)}` : str(j.title)
    ) ??
    list("documents", (doc) => str(doc.title)) ??
    list("flagships", (f) => str(f.title)) ??
    list("projects", (p) => str(p.title));
  return refs && refs.length > 0 ? refs : null;
}

const POSITIONS: Record<string, number> = {
  first: 0,
  "1st": 0,
  one: 0,
  top: 0,
  second: 1,
  "2nd": 1,
  two: 1,
  third: 2,
  "3rd": 2,
  three: 2,
  fourth: 3,
  "4th": 3,
  four: 3,
  fifth: 4,
  "5th": 4,
  five: 4,
  last: -1,
};

const NOUN = "(?:one|role|job|result|position|document|doc|project|flagship|option)";
const BARE_POSITION = new RegExp(
  `^(?:the\\s+)?(?:(\\w+)(?:\\s+${NOUN})?|(?:number|no\\.?|#)\\s*(\\d+))$`,
  "i"
);
const THAT_ONE = new RegExp(`^(?:that|this|it|the)(?:\\s+${NOUN})?$`, "i");

/** The name a bare position stands for, or null when the words are not a bare position. */
export function resolvePosition(said: string, refs: VoiceRef[]): string | null {
  if (refs.length === 0) return null;
  const words = said
    .trim()
    .replace(/[.!?,]+$/, "")
    .trim();
  // "that one" means something only when exactly one thing was just said.
  if (THAT_ONE.test(words)) return refs.length === 1 ? refs[0]!.label : null;
  const match = words.match(BARE_POSITION);
  if (!match) return null;
  if (match[2] && Number(match[2]) < 1) return null;
  const index = match[2] ? Number(match[2]) - 1 : POSITIONS[match[1]!.toLowerCase()];
  if (index === undefined || Number.isNaN(index)) return null;
  const ref = index < 0 ? refs[refs.length + index] : refs[index];
  return ref?.label ?? null;
}

/** Arguments with every bare position replaced by the name it stands for. */
export function withPositionsResolved(
  args: Record<string, unknown>,
  refs: VoiceRef[]
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...args };
  for (const [key, value] of Object.entries(args)) {
    if (typeof value !== "string") continue;
    const named = resolvePosition(value, refs);
    if (named) out[key] = named;
  }
  return out;
}

const SAID_POSITION = new RegExp(
  `\\b(?:the\\s+)?(first|second|third|fourth|fifth|last|top|1st|2nd|3rd|4th|5th)\\s+${NOUN}\\b|\\bnumber\\s+(\\d+)\\b`,
  "i"
);

/**
 * The item a person picked by position in their OWN words ("save the second one"), or null.
 *
 * Read from what they said, not from the model's arguments: a small model asked to save "the
 * second one" passes a guessed name instead (5 Oct 2026, llama3.2 3B). A position needs a noun
 * ("one", "role", …), so "a second interview" is not a position.
 */
export function positionSaid(text: string, refs: VoiceRef[]): string | null {
  const match = text.match(SAID_POSITION);
  if (!match) return null;
  return resolvePosition(match[2] ? `number ${match[2]}` : match[1]!, refs);
}
