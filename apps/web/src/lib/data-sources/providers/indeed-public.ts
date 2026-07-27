import * as cheerio from "cheerio";

import { inferRemote, inferSalaryInterval, normalizeJobType } from "../normalize";
import type { DataSourceCapability, JobPosting, JobSource, SignalQuery } from "../types";

/**
 * Indeed — public search results.
 *
 * DELIBERATE DEVIATION FROM JOBSPY. JobSpy's Indeed scraper calls
 * `apis.indeed.com/graphql` using an API key lifted from Indeed's iOS app plus
 * headers impersonating `com.indeed.jobsearch`. That is authenticating as Indeed's
 * own app with Indeed's own credential, so it is not ours to use regardless of who
 * accepts the risk — and the credential, not the technique, is what makes it work.
 *
 * This reads the same public search page a logged-out visitor sees. No key, no app
 * impersonation. The trade-off is honest and worth knowing:
 *   · fewer fields (no company revenue/industry/logo, no direct-apply URL)
 *   · no cursor pagination — offset only, and Indeed caps how deep it will serve
 *   · far more fragile: Indeed fronts this with bot detection and WILL return a
 *     challenge page rather than results, often
 *
 * When it is blocked it returns [] and the jobs board carries on with its other
 * sources. It never throws and never fabricates.
 *
 * ‼ EXPERIMENTAL — OFF unless SCRAPERS_ENABLED=1.
 */

const FETCH_TIMEOUT_MS = 10_000;
const MAX_PAGES = 2;
const PAGE_STEP = 10;
const DELAY_MIN_MS = 4000;
const DELAY_BAND_MS = 4000;

const HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "accept-language": "en-US,en;q=0.9",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Indeed's country → domain map (JobSpy's `Country` enum, trimmed to the common set). */
const DOMAINS: Record<string, string> = {
  us: "www", gb: "uk", uk: "uk", ie: "ie", ca: "ca", au: "au", nz: "nz",
  de: "de", fr: "fr", es: "es", it: "it", nl: "nl", in: "in", sg: "sg",
};

function domainFor(country?: string): string {
  return DOMAINS[(country ?? "us").toLowerCase()] ?? "www";
}

/**
 * Parse Indeed's server-rendered result cards.
 *
 * Verified against a live `ie.indeed.com` response rather than assumed: Indeed used
 * to ship a `window.mosaic.providerData` JSON blob, and no longer does — the results
 * are plain server-rendered cards. Reading the blob returned zero jobs on a page that
 * clearly had sixteen, which is exactly the failure mode this parser must not repeat.
 *
 * Card anatomy as of the last verification:
 *   div.job_seen_beacon                    — one per result
 *     a[data-jk].jcs-JobTitle              — link; data-jk is the job key
 *       span[title]                        — the title (attribute is cleanest)
 *     [data-testid="company-name"]
 *     [data-testid="text-location"]        — e.g. "Hybrid work in Dublin, County Dublin"
 *     [data-testid="attribute_snippet_testid"] — job type AND salary share this testid
 */
export function parseIndeedCards(html: string, domain: string, sourceId: string): JobPosting[] {
  const $ = cheerio.load(html);
  const jobs: JobPosting[] = [];

  $("div.job_seen_beacon").each((_i, el) => {
    const card = $(el);
    // Indeed inlines <style> inside every card; leaving it in means .text() returns
    // several hundred characters of CSS glued onto the job title.
    card.find("style,script").remove();

    const link = card.find("a[data-jk]").first();
    const jk = link.attr("data-jk");
    if (!jk) return;

    const title = link.find("span[title]").attr("title")?.trim() || link.text().trim();
    const company = card.find('[data-testid="company-name"]').first().text().trim();
    const location = card.find('[data-testid="text-location"]').first().text().trim();
    if (!title || !company) return;

    // One testid carries two different kinds of fact. A snippet with a currency and a
    // digit is pay; everything else is an employment-type or benefit tag.
    const snippets = card
      .find('[data-testid="attribute_snippet_testid"]')
      .map((_j, e) => $(e).text().trim())
      .get()
      .filter(Boolean);

    const salaryText = snippets.find((s) => /[€£$]\s?[\d,]/.test(s));
    const tags = snippets
      .filter((s) => s !== salaryText)
      .map((s) => normalizeJobType(s) ?? s.toLowerCase());

    const salary = salaryText ? parseIndeedSalary(salaryText) : {};

    jobs.push({
      sourceId,
      externalId: `in-${jk}`,
      title,
      company,
      location: location || undefined,
      remote: inferRemote({ title, location }),
      url: `https://${domain}.indeed.com/viewjob?jk=${jk}`,
      tags,
      salaryText: salaryText || undefined,
      ...salary,
    });
  });

  return jobs;
}

/** "€45,000 - €55,000 a year" → structured pay. */
export function parseIndeedSalary(text: string): {
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryInterval?: JobPosting["salaryInterval"];
} {
  const symbol = text.match(/[€£$]/)?.[0];
  const currency =
    symbol === "£" ? "GBP" : symbol === "€" ? "EUR" : symbol === "$" ? "USD" : undefined;

  const numbers = [...text.matchAll(/[\d,]+(?:\.\d+)?/g)]
    .map((m) => Number(m[0].replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);

  return {
    salaryMin: numbers[0],
    salaryMax: numbers[1] ?? numbers[0],
    salaryCurrency: currency,
    salaryInterval: inferSalaryInterval(text) ?? undefined,
  };
}

export class IndeedPublicSource implements JobSource {
  readonly id = "indeed-public";
  readonly name = "Indeed (public search)";
  readonly capabilities: DataSourceCapability[] = ["job_listings"];
  readonly cost = "free" as const;
  readonly coverage = "general" as const;

  get isConfigured(): boolean {
    return process.env.SCRAPERS_ENABLED === "1";
  }

  async fetchJobs(query: SignalQuery): Promise<JobPosting[]> {
    if (!this.isConfigured) return [];

    const keywords = query.keywords.filter(Boolean).slice(0, 4).join(" ");
    if (!keywords) return [];

    const domain = domainFor(query.country);
    const location = [query.city, query.regions?.[0]].filter(Boolean).join(", ");
    const out: JobPosting[] = [];
    const seen = new Set<string>();

    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({ q: keywords, start: String(page * PAGE_STEP) });
      if (location) params.set("l", location);
      if (query.remoteOnly) params.set("sc", "0kf:attr(DSQF7);"); // Indeed's remote attribute

      let html: string;
      try {
        const res = await fetch(`https://${domain}.indeed.com/jobs?${params}`, {
          headers: HEADERS,
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        // 403/429 here means bot detection fired. Retrying makes it worse.
        if (!res.ok) break;
        html = await res.text();
      } catch {
        break;
      }

      const parsed = parseIndeedCards(html, domain, this.id);
      // No cards usually means a challenge page rather than "no results" — either
      // way there is nothing to parse and no reason to request page 2.
      if (parsed.length === 0) break;

      for (const job of parsed) {
        if (seen.has(job.externalId)) continue;
        seen.add(job.externalId);
        out.push(job);
      }

      if (page < MAX_PAGES - 1) await sleep(DELAY_MIN_MS + Math.random() * DELAY_BAND_MS);
    }

    return out;
  }
}
