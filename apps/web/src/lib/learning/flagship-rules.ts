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

/**
 * The project description a flagship starts with: the scenario first (the README's "The
 * problem"), then the work, then why it matters now and what it proves — so the planner
 * builds toward the business problem and the outcome, not just the tools named.
 */
export function flagshipDetail(flagship: Flagship): string {
  const context = [
    flagship.whyNow ? `Why now: ${flagship.whyNow}` : "",
    flagship.demonstrates ? `It should demonstrate: ${flagship.demonstrates}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return [flagship.problem, `${flagship.build} Then: ${flagship.breakIt}`, context]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * KEEPING FLAGSHIPS STEADY.
 *
 * Weekly research used to REPLACE the flagships, so the three the person had been weighing were
 * gone when they came back — and three new ones appeared, which breeds the fear of always
 * missing a better one (owner, 15 Oct 2026). Now the current flagships change only when the
 * person changes them. Research adds "new" ideas beside them; whatever leaves the current set
 * becomes an "earlier" idea that can be brought back. Nothing is ever dropped silently.
 */
export type FlagshipIdea = { flagship: Flagship; state: "new" | "earlier"; at: string };

export const MAX_FLAGSHIPS = 3;
const MAX_IDEAS = 30;

const key = (flagship: Pick<Flagship, "title">) => flagship.title.trim().toLowerCase();

/** Fold a research pass in. The first pass fills the flagships; later passes only add ideas. */
export function mergeResearch(
  current: Flagship[],
  ideas: FlagshipIdea[],
  fresh: Flagship[],
  now: string
): { flagships: Flagship[]; ideas: FlagshipIdea[] } {
  if (current.length === 0) {
    const flagships = fresh.slice(0, MAX_FLAGSHIPS);
    const seen = new Set(flagships.map(key));
    return { flagships, ideas: ideas.filter((idea) => !seen.has(key(idea.flagship))) };
  }
  const seen = new Set([...current.map(key), ...ideas.map((idea) => key(idea.flagship))]);
  const added: FlagshipIdea[] = fresh
    .filter((flagship) => !seen.has(key(flagship)))
    .map((flagship) => ({ flagship, state: "new", at: now }));
  // Last pass's "new" ideas were seen: they are earlier ideas now.
  const kept = ideas.map((idea) =>
    idea.state === "new" ? { ...idea, state: "earlier" as const } : idea
  );
  return { flagships: current, ideas: [...added, ...kept].slice(0, MAX_IDEAS) };
}

/**
 * Make an idea one of the flagships: added when there is room, otherwise in place of the one
 * named — which becomes an earlier idea, never deleted.
 */
export function adoptIdea(
  current: Flagship[],
  ideas: FlagshipIdea[],
  title: string,
  replaceTitle: string | null,
  now: string
): { flagships: Flagship[]; ideas: FlagshipIdea[] } | null {
  const idea = ideas.find((i) => key(i.flagship) === title.trim().toLowerCase());
  if (!idea) return null;
  const rest = ideas.filter((i) => i !== idea);
  if (!replaceTitle) {
    if (current.length >= MAX_FLAGSHIPS) return null;
    return { flagships: [...current, idea.flagship], ideas: rest };
  }
  const out = current.find((f) => key(f) === replaceTitle.trim().toLowerCase());
  if (!out) return null;
  return {
    flagships: current.map((f) => (f === out ? idea.flagship : f)),
    ideas: [{ flagship: out, state: "earlier", at: now }, ...rest],
  };
}

/** Set a flagship aside: it becomes an earlier idea. */
export function setAside(
  current: Flagship[],
  ideas: FlagshipIdea[],
  title: string,
  now: string
): { flagships: Flagship[]; ideas: FlagshipIdea[] } | null {
  const out = current.find((f) => key(f) === title.trim().toLowerCase());
  if (!out) return null;
  return {
    flagships: current.filter((f) => f !== out),
    ideas: [{ flagship: out, state: "earlier" as const, at: now }, ...ideas].slice(0, MAX_IDEAS),
  };
}
