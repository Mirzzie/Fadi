/**
 * Live job/news sources return HTML descriptions (Remotive, Arbeitnow, etc.).
 * We store and surface plain text, so strip tags + decode the common entities
 * here at the normalization seam — every consumer (job card, Kai context,
 * workspace) then gets clean, readable copy instead of raw `<p>` soup.
 */

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
};

/** Convert an HTML fragment to compact, readable plain text. */
export function htmlToText(html: string | undefined | null, maxLength = 1200): string {
  if (!html) return "";

  let text = html
    // Turn block-ish boundaries into line breaks before tags are removed.
    .replace(/<\/(p|div|li|h[1-6]|ul|ol|br)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    // Drop every remaining tag.
    .replace(/<[^>]+>/g, " ");

  // Decode named/numeric entities.
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  for (const [entity, char] of Object.entries(ENTITIES)) {
    text = text.split(entity).join(char);
  }

  // Collapse whitespace: trim each line, drop empties, cap blank runs.
  text = text
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  if (text.length > maxLength) {
    text = `${text.slice(0, maxLength).trimEnd()}…`;
  }

  return text;
}
