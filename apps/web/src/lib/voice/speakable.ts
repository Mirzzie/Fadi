/**
 * Turning something written into something sayable.
 *
 * Fadi's own answers come back as markdown — headings, bold, and sometimes a table of roles.
 * Spoken raw, a pipe table is a minute of "pipe, dash, dash, pipe", and the person hears none
 * of the four jobs in it. Nothing here changes what Fadi MEANS; it changes how it is read.
 *
 * It also stops. An answer that would take two minutes to hear is cut at a sentence boundary
 * with an honest tail, because someone listening cannot skim and will not wait.
 */

const MAX_SPOKEN = 700;

/** A markdown table row becomes its cells, in order, as a phrase. */
function tableRow(line: string): string | null {
  if (!line.includes("|")) return null;
  const cells = line
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
  // The separator row (---|---) carries no words at all.
  if (cells.length === 0 || cells.every((cell) => /^:?-{2,}:?$/.test(cell))) return "";
  return cells.join(", ");
}

export function speakable(markdown: string, max = MAX_SPOKEN): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const spoken: string[] = [];

  for (const raw of lines) {
    const asTable = tableRow(raw);
    const line = (asTable ?? raw)
      .replace(/```[^`]*```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/^\s*#{1,6}\s*/, "")
      .replace(/^\s*[-*+]\s+/, "")
      .replace(/^\s*\d+\.\s+/, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_{1,2}([^_]+)_{1,2}/g, "$1")
      .replace(/^\s*>\s?/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (line) spoken.push(/[.!?,:;]$/.test(line) ? line : `${line}.`);
  }

  const text = spoken.join(" ").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;

  // Cut at the last sentence that fits, so it never stops in the middle of a fact.
  const head = text.slice(0, max);
  const lastStop = Math.max(head.lastIndexOf(". "), head.lastIndexOf("? "), head.lastIndexOf("! "));
  const cut = lastStop > max * 0.4 ? head.slice(0, lastStop + 1) : head;
  return `${cut.trim()} There's more — it's on screen, or ask me for the rest.`;
}
