/**
 * FLAGSHIP PROJECTS: two or three substantial pieces of work per direction, instead of a pile
 * of small ones.
 *
 * Hiring managers skim. Twenty tutorial repos read as someone who follows instructions; three
 * projects that each answer a problem an organisation is actually facing now — built, tested
 * until something broke, fixed, and explained — read as someone who can take one of their
 * problems off their hands. So a flagship starts from a CURRENT, CITED business problem and
 * from what this person's record can credibly grow into, and it is refreshed on a clock
 * because the problems move.
 *
 * Pure rules: what may be researched, what a proposal must carry, and which proposals survive.
 */

export type Flagship = {
  title: string;
  /** The business problem, stated as a scenario. */
  problem: string;
  /** Why it matters now — grounded in the cited sources. */
  whyNow: string;
  /** What gets built. */
  build: string;
  /** How it is tested or attacked, and what fixing that shows. */
  breakIt: string;
  /** What finishing it demonstrates for the target role. */
  demonstrates: string;
  /** Rough scope, e.g. "3–4 weeks of evenings". */
  scope: string;
  /** How it builds on the person's existing record, in one line; empty when it doesn't. */
  buildsOn: string;
  /** Research URLs this problem is grounded in — only ones the research actually returned. */
  sources: Array<{ url: string; title: string }>;
};

/** How long a set of flagships stays current before it is researched again. */
export const FLAGSHIP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function flagshipsAreStale(refreshedAt: Date | string | null | undefined, now = Date.now()) {
  if (!refreshedAt) return true;
  const at = new Date(refreshedAt).getTime();
  return !Number.isFinite(at) || now - at >= FLAGSHIP_TTL_MS;
}

/**
 * What to search this month: the problems organisations hiring this role are reporting, in
 * the words they would use — not the technologies, which is how projects end up generic.
 */
export function researchQueries(input: {
  role: string;
  domain?: string | null;
  gaps?: string[];
  year: number;
}): string[] {
  const field = input.domain?.trim() || input.role;
  return [
    `${field} biggest challenges organisations face ${input.year}`,
    `${input.role} incident OR breach OR outage lessons ${input.year}`,
    `${field} new regulation OR compliance deadline ${input.year}`,
    ...(input.gaps ?? []).slice(0, 2).map((gap) => `${gap} problems companies ${input.year}`),
  ];
}

/**
 * Keep only proposals a person can trust: grounded in at least one source the research really
 * returned (a model citing a URL it was not given is inventing evidence), complete enough to
 * start, and at most three — "two or three big projects" is the point.
 */
/**
 * Drop every sentence that states a figure the research does not contain.
 *
 * Measured on the first live run (29 Sep 2026, a 3B local model): "61% of Irish businesses",
 * "€10,000 per month in lost productivity", "$1 million per month" — none of them in any source.
 * A prompt asking for no invented statistics is not enough; a sentence carrying one is removed.
 * Years pass (they are how "now" is said); percentages, money and other numbers must appear in
 * the research text to survive.
 */
export function withoutUnsupportedFigures(text: string, corpus: string): string {
  const haystack = corpus.toLowerCase().replace(/\s+/g, " ");
  const figures = (sentence: string) =>
    (
      sentence.match(
        /[$€£]\s?\d[\d,.]*\s*(?:k|m|bn|million|billion)?|\d[\d,.]*\s*(?:%|percent|million|billion)|\b\d{2,}[\d,.]*\b/gi
      ) ?? []
    )
      .map((figure) => figure.toLowerCase().trim())
      .filter((figure) => !/^(19|20)\d{2}$/.test(figure));
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => figures(sentence).every((figure) => haystack.includes(figure)))
    .join(" ")
    .trim();
}

export function acceptFlagships(
  proposals: Array<Partial<Flagship> & { sourceUrls?: string[] }>,
  research: Array<{ url: string; title?: string; snippet?: string }>
): Flagship[] {
  const byUrl = new Map(research.map((hit) => [hit.url, hit.title ?? hit.url]));
  const corpus = research.map((hit) => `${hit.title ?? ""} ${hit.snippet ?? ""}`).join(" ");
  const out: Flagship[] = [];
  for (const proposal of proposals) {
    const sources = [...new Set(proposal.sourceUrls ?? [])]
      .filter((url) => byUrl.has(url))
      .map((url) => ({ url, title: byUrl.get(url)! }));
    const text = (value: string | undefined) => value?.trim() ?? "";
    const grounded = (value: string | undefined) => withoutUnsupportedFigures(text(value), corpus);
    const flagship: Flagship = {
      // "Flagship Project 2: …" is numbering, not a name.
      title: text(proposal.title).replace(/^(flagship\s+)?project\s*\d+\s*[:.\-–—]\s*/i, ""),
      problem: grounded(proposal.problem),
      whyNow: grounded(proposal.whyNow),
      build: text(proposal.build),
      breakIt: text(proposal.breakIt),
      demonstrates: text(proposal.demonstrates),
      scope: text(proposal.scope),
      buildsOn: text(proposal.buildsOn),
      sources,
    };
    if (!flagship.title || !flagship.problem || !flagship.build || !flagship.breakIt) continue;
    if (research.length > 0 && sources.length === 0) continue;
    out.push(flagship);
    if (out.length === 3) break;
  }
  return out;
}

/** The project description a flagship starts with: scenario first, then the work. */
export function flagshipDetail(flagship: Flagship): string {
  return `${flagship.problem}\n\n${flagship.build} Then: ${flagship.breakIt}`;
}
