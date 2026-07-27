import * as cheerio from "cheerio";

import type { DataSourceCapability, JobPosting, JobSource, SignalQuery } from "../types";

/**
 * LinkedIn — public guest job search.
 *
 * A TypeScript port of JobSpy's LinkedIn scraper (cullenwatson/JobSpy), kept faithful to
 * its method so the technique is legible:
 *
 *   GET /jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=&location=&start=
 *
 * This is the endpoint that powers the logged-out "see more jobs" list. It takes no
 * auth, no cookie and no API key — it returns a fragment of HTML job cards, which is
 * why the whole scraper is really just a careful CSS-selector read. JobSpy uses
 * BeautifulSoup; this uses cheerio, which is the same idea with the same selectors.
 *
 * WHY THIS EXISTS: the platform's licensed feeds (Adzuna, Reed, Jooble, Remotive…) miss
 * most of what a job seeker actually browses. This closes that gap for experimentation.
 *
 * ‼ EXPERIMENTAL — OFF BY DEFAULT. Enable with SCRAPERS_ENABLED=1. Scraping LinkedIn is
 * against their terms and they rate-limit aggressively (429) and change markup without
 * notice. It is deliberately behind a flag so it can never be on by accident, and every
 * failure degrades to an empty array rather than breaking the jobs board.
 *
 * Techniques carried over from JobSpy, and why each one is there:
 *   · paginate by `start` in steps of the returned card count
 *   · randomised 3–7s delay between pages — the single most important politeness knob;
 *     hammering this endpoint is what earns a 429
 *   · treat 429 as "stop now", not "retry harder"
 *   · dedupe by the job id parsed out of the card link
 *   · a browser-like User-Agent (the endpoint returns nothing useful without one)
 */

const BASE = "https://www.linkedin.com";
const SEARCH = `${BASE}/jobs-guest/jobs/api/seeMoreJobPostings/search`;

/** JobSpy uses 25/page; the endpoint returns ~10 per call in practice. */
const PAGE_STEP = 10;
const MAX_PAGES = 3;
const DELAY_MIN_MS = 3000;
const DELAY_BAND_MS = 4000;
const FETCH_TIMEOUT_MS = 10_000;

const HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "accept-language": "en-US,en;q=0.9",
  accept: "text/html,application/xhtml+xml",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** "…-software-engineer-at-acme-3801234567" → "3801234567" */
function jobIdFromHref(href: string): string | null {
  const path = href.split("?")[0];
  const id = path.split("-").pop();
  return id && /^\d+$/.test(id) ? id : null;
}

/** "£45,000 - £55,000" → { min, max, currency }. Ported from JobSpy's currency_parser. */
export function parseSalary(raw: string): {
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
} {
  const text = raw.trim();
  if (!text) return {};
  const symbol = text[0];
  const currency =
    symbol === "£" ? "GBP" : symbol === "€" ? "EUR" : symbol === "$" ? "USD" : undefined;

  const numbers = text
    .split("-")
    .map((part) => Number(part.replace(/[^0-9.]/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (numbers.length === 0) return { salaryCurrency: currency };
  return {
    salaryMin: numbers[0],
    salaryMax: numbers[1] ?? numbers[0],
    salaryCurrency: currency,
  };
}

export class LinkedInGuestSource implements JobSource {
  readonly id = "linkedin-guest";
  readonly name = "LinkedIn (guest search)";
  readonly capabilities: DataSourceCapability[] = ["job_listings"];
  readonly cost = "free" as const;
  /** Cross-industry: LinkedIn carries every field, so never domain-filtered. */
  readonly coverage = "general" as const;

  get isConfigured(): boolean {
    // Explicit opt-in only. No flag, no scraping.
    return process.env.SCRAPERS_ENABLED === "1";
  }

  async fetchJobs(query: SignalQuery): Promise<JobPosting[]> {
    if (!this.isConfigured) return [];

    const keywords = query.keywords.filter(Boolean).slice(0, 4).join(" ");
    if (!keywords) return [];
    const location = [query.city, query.regions?.[0]].filter(Boolean).join(", ");

    const out: JobPosting[] = [];
    const seen = new Set<string>();

    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({
        keywords,
        start: String(page * PAGE_STEP),
      });
      if (location) params.set("location", location);
      // f_WT=2 is LinkedIn's "remote" work-type filter.
      if (query.remoteOnly) params.set("f_WT", "2");

      let html: string;
      try {
        const res = await fetch(`${SEARCH}?${params}`, {
          headers: HEADERS,
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        // 429 means we're being told to stop. Backing off harder is the only
        // correct response; retrying immediately gets the IP blocked outright.
        if (res.status === 429 || !res.ok) break;
        html = await res.text();
      } catch {
        break; // network/timeout — degrade to whatever we already have
      }

      const cards = this.parseCards(html);
      if (cards.length === 0) break;

      for (const card of cards) {
        if (seen.has(card.externalId)) continue;
        seen.add(card.externalId);
        out.push(card);
      }

      // Politeness delay — the reason this scraper survives more than one run.
      if (page < MAX_PAGES - 1) {
        await sleep(DELAY_MIN_MS + Math.random() * DELAY_BAND_MS);
      }
    }

    return out;
  }

  /**
   * Parse a page of job cards. Selectors mirror JobSpy's BeautifulSoup reads exactly —
   * if LinkedIn changes its markup, this is the one place to update.
   */
  private parseCards(html: string): JobPosting[] {
    const $ = cheerio.load(html);
    const jobs: JobPosting[] = [];

    $("div.base-search-card").each((_i, el) => {
      const card = $(el);
      const href = card.find("a.base-card__full-link").attr("href");
      if (!href) return;
      const id = jobIdFromHref(href);
      if (!id) return;

      const title = card.find("span.sr-only").first().text().trim();
      const company = card.find("h4.base-search-card__subtitle a").first().text().trim();
      const location = card
        .find("div.base-search-card__metadata span.job-search-card__location")
        .first()
        .text()
        .trim();

      const postedAt = card
        .find("time.job-search-card__listdate, time.job-search-card__listdate--new")
        .first()
        .attr("datetime");

      const salaryText = card.find("span.job-search-card__salary-info").first().text().trim();
      const salary = salaryText ? parseSalary(salaryText) : {};

      if (!title || !company) return;

      jobs.push({
        sourceId: this.id,
        externalId: `li-${id}`,
        title,
        company,
        location: location || undefined,
        // The guest card never states remote directly; infer only from explicit text.
        remote: /remote/i.test(`${title} ${location}`) || undefined,
        url: `${BASE}/jobs/view/${id}`,
        tags: [],
        postedAt: postedAt || undefined,
        salaryText: salaryText || undefined,
        ...salary,
      });
    });

    return jobs;
  }
}
