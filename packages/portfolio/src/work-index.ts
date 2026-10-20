import type { PortfolioItemView } from "./view";

/**
 * THE LOGIC BEHIND THE WORK-INDEX TEMPLATE.
 *
 * A portfolio is not a shorter résumé. A résumé lists what you *were*; a portfolio
 * explains what you made and what happened. Media and links strengthen a case, but
 * are optional supporting material rather than an admission requirement.
 *
 * NOTHING IS HARDCODED. The owner will keep adding work for years, so the lead case
 * is chosen, never named; the skill index is derived from whatever words their own
 * items carry; and a section that has no items simply doesn't render. Adding a new
 * project must never require touching this file.
 *
 * Pure and deterministic so it can be unit-tested without a DOM or a database.
 */

/** Sections whose items are "work" — the things that can carry proof. */
const CASE_SECTIONS = new Set(["project", "achievement", "custom"]);

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
 * The opener. Media raises a case's score, but a useful written case is still work
 * and can lead when it is the strongest item available.
 */
export function pickLead(items: PortfolioItemView[]): PortfolioItemView | null {
  return rankCases(items)[0] ?? null;
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

/** Everything a visitor can read on a case, as one searchable string. */
function caseText(item: PortfolioItemView): string {
  return [item.title, item.subtitle, item.description, ...(item.bullets ?? []), item.tag]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Does this case name that skill?
 *
 * Whole words only, so "SOC" does not match "society" and "Go" does not match "going". A
 * multi-word skill must appear as the phrase — "Server Administration" is not backed by a case
 * that happens to contain "server" and, elsewhere, "administration".
 */
export function mentionsSkill(item: PortfolioItemView, skill: string): boolean {
  const needle = skill.trim().toLowerCase();
  if (needle.length < 2) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(caseText(item));
}

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

  /**
   * A SKILL THE WORK NAMES IS BACKED BY THAT WORK.
   *
   * Backing used to come only from a case's single `tag` (plus its personas). Measured on the
   * owner's real site: sixteen listed skills, zero backed, because their tags read "IaC",
   * "Homelab", "Blue Team" while their skills read "Ansible", "AWS Cloud", "Terraform" — two
   * vocabularies kept by hand. Worse, a case has ONE tag, so seven projects could never back
   * sixteen skills however diligently anyone tagged. The page told them to "tag the work that
   * proves each one", which was not a thing they could do.
   *
   * So a case also backs a skill it NAMES — in its title, description or bullets. That is the
   * same standard the filter promises a visitor: click the skill, read the work that says it.
   * Nothing here invents a claim; it only notices one the owner already wrote.
   */
  for (const item of items.filter((i) => i.section === "skill")) {
    const slug = slugify(item.title);
    const found = counts.get(slug);
    if (found) {
      // A named skill the owner listed separately gets the nicer label when the work already
      // backs it — "Ansible" rather than whatever casing a tag happened to use.
      found.label = item.title;
      continue;
    }
    const named = items.filter((c) => isCase(c) && mentionsSkill(c, item.title)).length;
    if (named > 0) counts.set(slug, { label: item.title, count: named });
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

/**
 * Every skill slug this case answers to — its own tags, plus the listed skills it names.
 *
 * The filter and the index MUST agree. Counting a skill as backed because a case mentions it,
 * while the case's `data-skills` still carried only its tag, would have produced a skill chip
 * that filters to nothing — worse than hiding it.
 */
export function caseSkillSlugs(item: PortfolioItemView, skillLabels: string[]): string[] {
  const slugs = new Set(caseSkills(item).map(slugify).filter(Boolean));
  for (const label of skillLabels) {
    if (mentionsSkill(item, label)) slugs.add(slugify(label));
  }
  return [...slugs].filter(Boolean);
}
