import type { EvidenceItem, PortfolioItem, PortfolioSite } from "@careeros/database";

// The public shape of a portfolio, shared by the Content API and the renderer.
// This is the stack-agnostic contract any website (ours or a third party) reads.

export type PortfolioSiteView = {
  handle: string;
  title: string;
  headline: string | null;
  template: string;
  theme: Record<string, unknown>;
  profile: Record<string, unknown>;
  resumeLinks: Record<string, string>;
};

export type PortfolioItemView = {
  id: string;
  section: string;
  title: string;
  subtitle: string | null;
  location: string | null;
  dateRange: string | null;
  description: string | null;
  bullets: string[];
  roles: string[];
  tag: string | null;
  url: string | null;
  imageUrl: string | null;
  gallery: string[];
  isPublished: boolean;
  /**
   * Null = collected automatically and not yet looked at, so it is NOT on the public
   * site. The manager shows these plainly; hiding them would trade one silent failure
   * for another.
   */
  confirmedAt?: string | null;
};

// Interchange shape — matches the standalone portfolio's export JSON (snake_case)
// so its export imports straight into Fadi, and Fadi's export round-trips.
export type PortfolioItemExport = {
  section: string;
  title: string;
  subtitle: string | null;
  location: string | null;
  date_range: string | null;
  roles: string[];
  description: string | null;
  tag: string | null;
  url: string | null;
  image_url: string | null;
  gallery: string[];
  bullets: string[];
  sort_order: number;
  is_published: boolean;
};

export type PortfolioExport = {
  version: 1;
  exported_at: string;
  items: PortfolioItemExport[];
};

export type PortfolioView = {
  site: PortfolioSiteView;
  items: PortfolioItemView[];
};

export function toSiteView(site: PortfolioSite): PortfolioSiteView {
  return {
    handle: site.handle,
    title: site.title,
    headline: site.headline,
    template: site.template,
    theme: site.theme ?? {},
    profile: site.profile ?? {},
    resumeLinks: site.resumeLinks ?? {},
  };
}

export function toItemView(item: PortfolioItem): PortfolioItemView {
  return {
    id: item.id,
    section: item.section,
    title: item.title,
    subtitle: item.subtitle,
    location: item.location,
    dateRange: item.dateRange,
    description: item.description,
    bullets: item.bullets ?? [],
    roles: item.roles ?? [],
    tag: item.tag,
    url: item.url,
    imageUrl: item.imageUrl,
    gallery: item.gallery ?? [],
    isPublished: item.isPublished,
    confirmedAt: item.confirmedAt ? new Date(item.confirmedAt).toISOString() : null,
  };
}

/** Item → interchange (snake_case) for export. */
export function toExportItem(item: PortfolioItem): PortfolioItemExport {
  return {
    section: item.section,
    title: item.title,
    subtitle: item.subtitle,
    location: item.location,
    date_range: item.dateRange,
    roles: item.roles ?? [],
    description: item.description,
    tag: item.tag,
    url: item.url,
    image_url: item.imageUrl,
    gallery: item.gallery ?? [],
    bullets: item.bullets ?? [],
    sort_order: item.sortOrder,
    is_published: item.isPublished,
  };
}

/** Interchange (snake_case, from portfolio export or Fadi) → DB insert fields. */
export function fromExportItem(
  raw: Partial<PortfolioItemExport>,
): {
  section: string;
  title: string;
  subtitle: string | null;
  location: string | null;
  dateRange: string | null;
  roles: string[];
  description: string | null;
  tag: string | null;
  url: string | null;
  imageUrl: string | null;
  gallery: string[];
  bullets: string[];
  sortOrder: number;
  isPublished: boolean;
} {
  return {
    section: typeof raw.section === "string" ? raw.section : "custom",
    title: (raw.title ?? "").toString(),
    subtitle: raw.subtitle ?? null,
    location: raw.location ?? null,
    dateRange: raw.date_range ?? null,
    roles: Array.isArray(raw.roles) ? raw.roles : [],
    description: raw.description ?? null,
    tag: raw.tag ?? null,
    url: raw.url ?? null,
    imageUrl: raw.image_url ?? null,
    gallery: Array.isArray(raw.gallery) ? raw.gallery : [],
    bullets: Array.isArray(raw.bullets) ? raw.bullets : [],
    sortOrder: typeof raw.sort_order === "number" ? raw.sort_order : 0,
    isPublished: raw.is_published !== false,
  };
}

export function toPortfolioView(site: PortfolioSite, items: PortfolioItem[]): PortfolioView {
  return { site: toSiteView(site), items: items.map(toItemView) };
}

// Maps an evidence kind → the portfolio section it seeds into.
const EVIDENCE_SECTION: Record<string, string> = {
  experience: "experience",
  project: "project",
  achievement: "project",
  skill: "skill",
  education: "education",
};

/**
 * Seed portfolio items from the user's evidence pool. This is the "single source
 * of truth → projection" step: facts come straight from evidence; the narrative
 * `description` starts from the evidence detail and is meant to be AI-enhanced /
 * user-curated afterward (never invented here).
 */
export function seedItemsFromEvidence(
  evidence: EvidenceItem[],
): Array<{
  evidenceItemId: string;
  section: string;
  title: string;
  subtitle: string | null;
  dateRange: string | null;
  description: string | null;
  bullets: string[];
  tag: string | null;
  sortOrder: number;
}> {
  return evidence.map((e, i) => ({
    evidenceItemId: e.id,
    section: EVIDENCE_SECTION[e.kind] ?? "custom",
    title: e.title,
    subtitle: e.organization ?? null,
    dateRange: e.period ?? null,
    description: e.detail || null,
    bullets: e.metrics ? [e.metrics] : [],
    tag: e.tags?.[0] ?? null,
    sortOrder: (i + 1) * 10,
  }));
}

// ── Duplicate detection for sync ──────────────────────────────────────────────
// Exact-title matching is too weak: the same real credential shows up worded differently
// across sources ("MSc" vs "M.Sc.", "BCA, Computer Science" vs "Bachelor of Computer
// Application (BCA)"), so an exact check re-adds it as a duplicate. This decides whether two
// entries are the SAME thing — biased to avoid FALSE merges (losing a distinct entry is worse
// than an occasional missed dedup the user can delete).

type EntryLike = { section: string; title: string; subtitle?: string | null; dateRange?: string | null };

const STOP = new Set(["of", "the", "and", "for", "a", "an", "at", "to", "in", "on", "de", "du"]);
const collapse = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const wordsOf = (s: string | null | undefined) => (s ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [];

function yearsOf(s: string | null | undefined): [number, number] | null {
  const ys = (s ?? "").match(/\b(?:19|20)\d{2}\b/g)?.map(Number) ?? [];
  return ys.length ? [Math.min(...ys), Math.max(...ys)] : null;
}
function orgSimilar(a?: string | null, b?: string | null): boolean {
  const x = collapse(a);
  const y = collapse(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}
function yearsOverlap(a?: string | null, b?: string | null): boolean {
  const x = yearsOf(a);
  const y = yearsOf(b);
  if (!x || !y) return true; // missing dates can't disprove a match
  return x[0] <= y[1] && y[0] <= x[1];
}
/** Do two titles name the same thing? Shared short code (e.g. "BCA") + non-contradicting subject. */
function titlesRelated(a: string, b: string, orgA: string, orgB: string): boolean {
  if (collapse(a) && collapse(a) === collapse(b)) return true;
  const orgTokens = new Set([...wordsOf(orgA), ...wordsOf(orgB)]);
  // Short alpha tokens = degree/cert codes ("bca", "saa"); ignore ones that are just the org.
  const codes = (t: string) =>
    new Set(
      wordsOf(t).filter(
        (w) => w.length >= 2 && w.length <= 5 && /^[a-z]+$/.test(w) && !STOP.has(w) && !orgTokens.has(w),
      ),
    );
  const ca = codes(a);
  const cb = codes(b);
  const sharedCode = [...ca].some((c) => cb.has(c));
  if (!sharedCode) return false;
  // A shared code isn't enough if the subjects clearly differ (MSc Cybersecurity vs MSc Data).
  const longs = (t: string) => new Set(wordsOf(t).filter((w) => w.length >= 5 && !STOP.has(w)));
  const la = longs(a);
  const lb = longs(b);
  if (la.size > 0 && lb.size > 0 && ![...la].some((w) => lb.has(w))) return false;
  return true;
}

/** True when two entries are the same real thing worded differently. Section-scoped. */
export function isSameEntry(a: EntryLike, b: EntryLike): boolean {
  if (a.section !== b.section) return false;
  // Unambiguous: identical once punctuation/spacing is ignored ("M.Sc." === "MSc").
  if (collapse(a.title) && collapse(a.title) === collapse(b.title)) return true;
  // Otherwise: same organisation + overlapping years + a related title.
  return (
    orgSimilar(a.subtitle, b.subtitle) &&
    yearsOverlap(a.dateRange, b.dateRange) &&
    titlesRelated(a.title, b.title, a.subtitle ?? "", b.subtitle ?? "")
  );
}
