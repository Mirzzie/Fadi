import { getCountry } from "@/lib/jobs/locations";

import type { JobPosting, SignalQuery } from "../../types";

// The Fadi Job Scraper automates the human job-search flow (navigate → search → filter →
// scroll → paginate → read) with a real browser, then normalizes to the same JobPosting
// shape as every API provider — so it joins the central orchestrator's fan-out/merge/dedupe
// as just another JobSource. Sites are described declaratively as "recipes" so adding a
// board is data, not a new scraper. Pure helpers here are unit-tested; the browser engine
// lives in ./browser and only loads when the scraper is enabled.

export type ScrapedRecord = {
  title?: string;
  company?: string;
  location?: string;
  url?: string;
  postedAt?: string;
  /** Full job description (JD) read off the page. */
  description?: string;
  /** schema.org validThrough — the closing date, for the expiry check. */
  validThrough?: string;
};

export type SiteRecipe = {
  id: string;
  name: string;
  /** Absolute origin, for resolving relative job links. */
  origin: string;
  /** Build the search URL for a query + page (the "typing keywords & filters" step). */
  searchUrl: (query: SignalQuery, page: number) => string;
  /** How many result pages to walk (the "paginate" step). */
  maxPages: number;
  /**
   * Extraction strategy for the "read each listing" step:
   * - "ai": the LLM extracts jobs from the rendered page text (self-healing, no selectors).
   * - "rendered": drive a real browser (defeats fetch-level walls), extract from the live DOM
   *   with a resilient anchor+JSON-LD heuristic — no LLM, no per-site selector config.
   * - "selectors": classic CSS extraction (cheaper/faster, but brittle).
   */
  mode?: "ai" | "rendered" | "selectors";
  /** CSS selectors — required only for `mode: "selectors"`. */
  selectors?: {
    card: string;
    title: string;
    company: string;
    location?: string;
    link: string;
  };
};

/** A few searchable terms from the (verbose) role/skill query. */
export function buildKeywords(query: SignalQuery): string {
  return query.keywords.slice(0, 4).map((k) => k.trim()).filter(Boolean).join(" ") || "jobs";
}

/** Pure: map a scraped record → normalized JobPosting (unit-tested; no browser). */
export function recordToPosting(r: ScrapedRecord, recipe: SiteRecipe): JobPosting | null {
  if (!r.title?.trim() || !r.company?.trim()) return null;
  let url: string | undefined;
  try {
    url = r.url ? new URL(r.url, recipe.origin).toString() : undefined;
  } catch {
    url = undefined;
  }
  return {
    sourceId: `fadi-scraper:${recipe.id}`,
    externalId: url ?? `${recipe.id}:${r.company.trim()}:${r.title.trim()}`,
    title: r.title.trim(),
    company: r.company.trim(),
    location: r.location?.trim() || undefined,
    remote: /remote/i.test(`${r.title} ${r.location ?? ""}`),
    url,
    tags: [],
    postedAt: r.postedAt,
  };
}

// Example recipe — a static-HTML, cross-field remote board. Selectors are a starting point
// Indeed's country domains — the browser renders these fine where a plain fetch is 403'd.
const INDEED_DOMAIN: Record<string, string> = {
  ie: "ie.indeed.com",
  gb: "uk.indeed.com",
  us: "www.indeed.com",
  ca: "ca.indeed.com",
  au: "au.indeed.com",
  in: "in.indeed.com",
  de: "de.indeed.com",
  nl: "nl.indeed.com",
  fr: "fr.indeed.com",
  sg: "sg.indeed.com",
};

// and are meant to be tuned against the live site (scraping is inherently maintenance).
export const RECIPES: SiteRecipe[] = [
  {
    // Fadi's own browser scraper on Indeed — a walled aggregator plain HTTP can't read.
    id: "indeed",
    name: "Indeed",
    origin: "https://www.indeed.com",
    searchUrl: (q) => {
      const dom = INDEED_DOMAIN[q.country ?? ""] ?? "www.indeed.com";
      const loc = q.city || getCountry(q.country)?.name || "";
      return `https://${dom}/jobs?q=${encodeURIComponent(buildKeywords(q))}&l=${encodeURIComponent(loc)}`;
    },
    maxPages: 1,
    mode: "rendered",
  },
  {
    id: "weworkremotely",
    name: "We Work Remotely",
    origin: "https://weworkremotely.com",
    searchUrl: (q) =>
      `https://weworkremotely.com/remote-jobs/search?term=${encodeURIComponent(buildKeywords(q))}`,
    maxPages: 1,
    // Selector mode: pure browser extraction, NO API/LLM dependence. (Set mode:"ai" to have
    // the LLM extract instead — self-healing but needs the AI provider.)
    mode: "selectors",
    selectors: {
      card: "section.jobs article li:not(.view-all)",
      title: "span.title",
      company: "span.company",
      location: "span.region",
      link: "a[href^='/remote-jobs/'], a[href^='/listings/']",
    },
  },
];
