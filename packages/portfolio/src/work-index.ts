import type { PortfolioItemView } from "./view";

/**
 * THE LOGIC BEHIND THE WORK-INDEX TEMPLATE.
 *
 * A portfolio is not a shorter résumé. A résumé lists what you *were*; a portfolio
 * shows what you *made*, with the artefact attached. So the unit here is a CASE —
 * context, what you did, the proof, the result — and everything below exists to
 * arrange cases by how well evidenced they are.
 *
 * NOTHING IS HARDCODED. The owner will keep adding work for years, so the lead case
 * is chosen, never named; the skill index is derived from whatever words their own
 * items carry; and a section that has no items simply doesn't render. Adding a new
 * project must never require touching this file.
 *
 * Pure and deterministic so it can be unit-tested without a DOM or a database.
 */

/** Sections whose items are "work" — the things that can carry proof. */
const CASE_SECTIONS = new Set(["project", "custom"]);

export function isCase(item: PortfolioItemView): boolean {
  return CASE_SECTIONS.has(item.section);
}

/**
 * A bullet that carries a measurement, as opposed to a description of activity.
 * "100% block rate on SQLi / XSS" is evidence; "Administered Linux servers" is a
 * duty. Digits are the cheapest reliable signal, and it is language-independent —
 * a nurse's "cut handover time by 12 minutes" reads the same way as an engineer's.
 */
export function isMeasurement(bullet: string): boolean {
  return /\d/.test(bullet);
}

export function splitBullets(bullets: string[]): { figures: string[]; notes: string[] } {
  const figures: string[] = [];
  const notes: string[] = [];
  for (const b of bullets) (isMeasurement(b) ? figures : notes).push(b);
  return { figures, notes };
}

/**
 * How well evidenced is this piece of work?
 *
 * Weighted so that things a reader can CHECK outrank things they must take on
 * trust: an image or a link is verifiable, a paragraph is an assertion. This is the
 * same principle the platform applies everywhere — evidence over claim.
 */
export function evidenceScore(item: PortfolioItemView): number {
  const { figures } = splitBullets(item.bullets ?? []);
  return (
    (item.imageUrl ? 3 : 0) +
    (item.gallery?.length ? 2 : 0) +
    (item.url ? 2 : 0) +
    Math.min(figures.length, 3) +
    (item.description ? 1 : 0)
  );
}

/** True when there is literally nothing for a reader to look at or click. */
export function hasArtifact(item: PortfolioItemView): boolean {
  return Boolean(item.imageUrl || item.gallery?.length || item.url);
}

/** Latest year mentioned in a date range, for recency ordering. 0 when undated. */
export function latestYear(dateRange: string | null | undefined): number {
  const years = String(dateRange ?? "").match(/\b(19|20)\d{2}\b/g);
  if (!years) return 0;
  return Math.max(...years.map(Number));
}

/**
 * Cases, best-evidenced first, then most recent. Deliberately NOT the owner's manual
 * sort order: the page argues for them, and the strongest argument should lead.
 */
export function rankCases(items: PortfolioItemView[]): PortfolioItemView[] {
  return items
    .filter(isCase)
    .slice()
    .sort(
      (a, b) =>
        evidenceScore(b) - evidenceScore(a) ||
        latestYear(b.dateRange) - latestYear(a.dateRange) ||
        a.title.localeCompare(b.title)
    );
}

/**
 * The opener. A portfolio should lead with work, not with a name — so this picks the
 * piece that can carry the top of the page, and returns null when nothing can
 * (a brand-new portfolio, or one where nothing has an artefact yet), so the template
 * can fall back rather than promoting an empty frame.
 */
export function pickLead(items: PortfolioItemView[]): PortfolioItemView | null {
  const lead = rankCases(items)[0];
  return lead && hasArtifact(lead) ? lead : null;
}

export type SkillEntry = { label: string; slug: string; count: number };

/** Lower-cased, punctuation-free key so "CI/CD" and "ci cd" are the same skill. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Every word a single case claims for itself: its tag, its audience tags. */
export function caseSkills(item: PortfolioItemView): string[] {
  return [item.tag, ...(item.roles ?? [])].filter((v): v is string => Boolean(v && v.trim()));
}

/**
 * SKILLS AS AN INDEX INTO THE EVIDENCE — the move that most separates this from a CV.
 *
 * A skills list is a row of unbacked claims. Here a skill only appears if some piece
 * of work demonstrates it, and it carries the count, so clicking it filters the page
 * to that proof. A claim you can click into stops being a claim.
 *
 * Skill-section items are included ONLY when the owner's work already mentions them;
 * a skill nothing backs is exactly the assertion this page exists to avoid making.
 */
export function skillIndex(items: PortfolioItemView[]): SkillEntry[] {
  const counts = new Map<string, { label: string; count: number }>();

  for (const item of items.filter(isCase)) {
    for (const raw of caseSkills(item)) {
      const slug = slugify(raw);
      if (!slug) continue;
      const found = counts.get(slug);
      if (found) found.count += 1;
      else counts.set(slug, { label: raw.trim(), count: 1 });
    }
  }

  // A named skill the owner listed separately gets the nicer label when the work
  // already backs it — "Ansible" rather than whatever casing a tag happened to use.
  for (const item of items.filter((i) => i.section === "skill")) {
    const slug = slugify(item.title);
    const found = counts.get(slug);
    if (found) found.label = item.title;
  }

  return [...counts.entries()]
    .map(([slug, v]) => ({ slug, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Skills the owner claims that NO piece of work backs — shown to them, never to visitors. */
export function unbackedSkills(items: PortfolioItemView[]): string[] {
  const backed = new Set(skillIndex(items).map((s) => s.slug));
  return items
    .filter((i) => i.section === "skill" && !backed.has(slugify(i.title)))
    .map((i) => i.title);
}

/**
 * EVERY HEADING ON THE PUBLIC PAGE, EDITABLE BY THE OWNER.
 *
 * The wording here was hardcoded English written for one person's career, which
 * made the page un-editable in exactly the way that matters: a midwife cannot call
 * her work "Featured work", a joiner has no "Qualifications" in that sense, and
 * nobody should have to ask a developer to change a heading on their own site.
 *
 * Overrides live in `portfolio_sites.theme.labels` — an existing jsonb column, so
 * this needs no migration — and anything the owner leaves blank falls back to the
 * default below. Adding a heading here makes it editable everywhere at once.
 */
export const DEFAULT_LABELS = {
  featured: "Featured work",
  skills: "What I can do — and where to check",
  skillsHint: "Pick one; the work filters to what proves it.",
  history: "Where this happened",
  historyHint: "Kept short on purpose — the work above is the argument.",
  education: "Education",
  certifications: "Certifications",
  beyond: "Outside the job",
  beyondHint: "Hardware, software, and the things I do because I want to.",
  note: "Leave a note",
  noteHint: "Thoughts on the work, a question, or anything you think I'd find useful.",
  contact: "Or reach me directly",
  // The buttons are wording too. A portfolio that says "Read the case study" under a
  // photography set, or "Book a call" to someone who does not take calls, is the
  // template talking over its owner — so these are editable like every heading above.
  caseCta: "Read the case study",
  detailCta: "See the detail",
  bookingCta: "Book a call",
  contactCta: "Get in touch",
  gap: "Nothing to show yet",
} as const;

export type PageLabels = Record<keyof typeof DEFAULT_LABELS, string>;
export const LABEL_KEYS = Object.keys(DEFAULT_LABELS) as (keyof typeof DEFAULT_LABELS)[];

/** Merge the owner's overrides over the defaults; blank or missing = default. */
export function labelsFor(theme: Record<string, unknown> | null | undefined): PageLabels {
  const raw = (theme?.labels ?? {}) as Record<string, unknown>;
  const out = {} as PageLabels;
  for (const k of LABEL_KEYS) {
    const v = raw[k];
    out[k] = typeof v === "string" && v.trim() ? v.trim() : DEFAULT_LABELS[k];
  }
  return out;
}
