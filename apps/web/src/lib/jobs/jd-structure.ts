/**
 * Structure a raw job-description text into LinkedIn-style sections —
 * deterministic heuristics, no AI call (this runs on every job card).
 *
 * Sources hand us wildly different shapes: clean line-broken text with "• "
 * bullets (HTML-derived), flat paragraphs with " - " inline bullets (plain-text
 * feeds), or a single wall of text. The parser recognizes the section headings
 * real postings use, splits bullet runs, and falls back gracefully — when no
 * structure is detectable the UI just shows paragraphs, never a worse view
 * than today's blob.
 */

export type JdSection = {
  /** null for the lead-in block before any recognized heading. */
  title: string | null;
  bullets: string[];
  paragraphs: string[];
};

export type StructuredJd = {
  sections: JdSection[];
  /** True when we found real structure (headings or bullets) worth rendering. */
  hasStructure: boolean;
};

/** Heading vocabulary seen across real postings (any field, not just tech). */
const HEADING_PATTERNS: RegExp[] = [
  /^about( the)? (role|job|position|company|us|you|team|opportunity)\b/i,
  /^(the|your) (role|company|team|mission|opportunity)\b/i,
  /^(key |core |main |primary )?(responsibilit|dut)(y|ies)\b/i,
  /^(minimum |basic |preferred |essential |desired )?(requirements?|qualifications?)\b/i,
  /^what (you('|’)?ll|you will|we('|’)?re|we are|you('|’)?d)\b/i,
  /^we('|’)?re looking for\b/i,
  /^who (you are|we are|we('|’)?re looking for)\b/i,
  /^your (profile|background|experience|skills)\b/i,
  /^(skills?|experience|education)( (and|&) (experience|qualifications?|abilities))?:?$/i,
  /^(nice|good) to have\b/i,
  /^bonus( points)?\b/i,
  /^(benefits|perks|compensation|salary|pay)( (and|&) (benefits|perks|compensation))?\b/i,
  /^what (we|you) (offer|get)\b/i,
  /^why (join|work|you('|’)?ll love)\b/i,
  /^using these skills\b/i,
  /^(how to apply|application process|next steps|interview process)\b/i,
  /^(equal opportunit|diversity|inclusion)\b/i,
];

const BULLET_PREFIX = /^([•◦▪‣*]|[-–—]|\d{1,2}[.)])\s+/;

function isHeading(line: string): boolean {
  if (line.length > 70) return false;
  const clean = line.replace(/[:.]+$/, "").trim();
  if (HEADING_PATTERNS.some((p) => p.test(clean))) return true;
  // A short line ending in ":" that isn't a bullet reads as a heading.
  return line.endsWith(":") && clean.length >= 3 && !BULLET_PREFIX.test(line);
}

/**
 * Plain-text feeds flatten bullet lists into one long line joined by " - ".
 * Split those back out; the part before the first separator is the lead-in.
 */
function splitInlineBullets(line: string): string[] | null {
  const parts = line.split(/\s-\s(?=[A-Z0-9])/);
  if (parts.length < 4 || line.length < 160) return null;
  return parts.map((p) => p.trim()).filter(Boolean);
}

function newSection(title: string | null): JdSection {
  return { title, bullets: [], paragraphs: [] };
}

function pruneEmpty(sections: JdSection[]): JdSection[] {
  return sections.filter((s) => s.bullets.length > 0 || s.paragraphs.length > 0 || s.title);
}

export function structureJobDescription(text: string | null | undefined): StructuredJd {
  if (!text?.trim()) return { sections: [], hasStructure: false };

  // Expand flattened bullet runs into real lines first.
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const inline = splitInlineBullets(line);
    if (inline) {
      lines.push(inline[0]);
      for (const item of inline.slice(1)) lines.push(`- ${item}`);
    } else {
      lines.push(line);
    }
  }

  const sections: JdSection[] = [newSection(null)];
  const current = () => sections[sections.length - 1];

  for (const line of lines) {
    if (isHeading(line)) {
      sections.push(newSection(line.replace(/[:.]+$/, "").trim()));
      continue;
    }
    const bulletMatch = line.match(BULLET_PREFIX);
    if (bulletMatch) {
      const content = line.slice(bulletMatch[0].length).trim();
      if (content) current().bullets.push(content);
      continue;
    }
    current().paragraphs.push(line);
  }

  const pruned = pruneEmpty(sections);
  const hasStructure =
    pruned.some((s) => s.title !== null) || pruned.some((s) => s.bullets.length >= 2);

  return { sections: pruned, hasStructure };
}
