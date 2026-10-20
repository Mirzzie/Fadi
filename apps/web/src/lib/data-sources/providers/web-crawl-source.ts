import { isLegitJob } from "@/lib/jobs/job-validation";
import { getCountry } from "@/lib/jobs/locations";
import { searchJobUrls, webSearchConfigured } from "@/lib/jobs/web-search";
import { logger } from "@/lib/observability/logger";

import type { DataSourceCapability, JobPosting, JobSource, SignalQuery } from "../types";

/** In-memory summary of the last crawl — for admin/debug visibility of the process. */
export type CrawlRun = { at: number; query: string; hits: number; pagesRead: number; jobs: number };
let _lastCrawl: CrawlRun | null = null;
export function getLastCrawlRun(): CrawlRun | null {
  return _lastCrawl;
}

// The Fadi Web Crawler — the "search the internet by itself" source. On each background pull it
// searches the open web for the user's role+location, VISITS the result pages, reads their
// content, extracts the full job (JSON-LD JobPosting) and keeps only NON-EXPIRED roles with a
// full JD. Runs server-side alongside the APIs; the admin sees every step in the logs, the user
// just sees results. Needs a search key (Brave) — self-reports unavailable without one.
export class WebCrawlSource implements JobSource {
  readonly id = "web-crawl";
  readonly name = "Fadi Web Crawler (searches the open web)";
  readonly capabilities: DataSourceCapability[] = ["job_listings"];
  readonly cost = "free" as const;
  readonly coverage = "general" as const; // web search spans every industry
  get isConfigured(): boolean {
    return webSearchConfigured();
  }

  async fetchJobs(query: SignalQuery): Promise<JobPosting[]> {
    if (!this.isConfigured) return [];

    const keywords = query.keywords.filter(Boolean).slice(0, 4).join(" ");
    const location = query.city || (query.country ? (getCountry(query.country)?.name ?? "") : "");
    const q = `${keywords} ${location}`.trim();

    // 1) Discover — search the open web across SEVERAL query variants for breadth. Accuracy
    //    over speed: a person doesn't stop at the first search, they rephrase ("… jobs",
    //    "… careers", top terms only) and open more results. We gather + dedupe those URLs.
    const kwHead = query.keywords.filter(Boolean).slice(0, 2).join(" ");
    const variants = [keywords, `${keywords} jobs`, `${kwHead} careers`].filter(
      (v, i, a) => v.trim() && a.indexOf(v) === i
    );
    const perVariant = await Promise.all(variants.map((v) => searchJobUrls(v, location, 12)));
    const seenUrl = new Set<string>();
    const hits = perVariant.flat().filter((h) => {
      if (seenUrl.has(h.url)) return false;
      seenUrl.add(h.url);
      return true;
    });
    logger.info("web_crawl.search", { q, variants: variants.length, hits: hits.length });
    if (hits.length === 0) {
      _lastCrawl = { at: Date.now(), query: q, hits: 0, pagesRead: 0, jobs: 0 };
      return [];
    }

    // 2) VISIT the pages in a real browser, in parallel (renders JS, gets past fetch-level
    //    walls), and read the full posting off each — JD, apply link, dates. Higher
    //    concurrency + more pages since we're not racing a page render anymore.
    const { scrapeJobPages } = await import("./fadi-scraper/browser");
    const records = await scrapeJobPages(
      hits.slice(0, 30).map((h) => h.url),
      6
    );
    const pagesRead = records.length;

    // 3) VALIDATE — drop expired and scam/lead-gen postings — then match the search.
    const kws = (query.keywords ?? []).map((k) => k.toLowerCase()).filter(Boolean);
    const countryName = query.country ? getCountry(query.country)?.name?.toLowerCase() : undefined;
    const city = query.city?.toLowerCase();
    const wantsLocation = Boolean(city || countryName);

    const out: JobPosting[] = [];
    for (const j of records) {
      if (!isLegitJob({ title: j.title, description: j.description, validThrough: j.validThrough }))
        continue;
      const hay = `${j.title} ${j.description ?? ""}`.toLowerCase();
      const loc = (j.location ?? "").toLowerCase();
      const isRemote = /\bremote\b|anywhere|work from home|wfh/.test(loc);
      const remoteAnywhere =
        isRemote && /\banywhere\b|worldwide|\bglobal\b|\bemea\b|\beurope\b/.test(loc);
      if (kws.length && !kws.some((k) => hay.includes(k))) continue;
      if (wantsLocation) {
        const ok =
          (city && loc.includes(city)) ||
          (countryName && loc.includes(countryName)) ||
          remoteAnywhere;
        if (!ok) continue;
      }
      let host = "";
      try {
        host = j.url ? new URL(j.url).hostname.replace(/^www\./, "") : "";
      } catch {
        /* keep empty */
      }
      out.push({
        sourceId: this.id,
        externalId: (j.url ?? `${j.company}:${j.title}`).slice(0, 250),
        title: j.title!,
        company: j.company || host || "Unknown",
        location: j.location,
        url: j.url, // the real apply / source link
        description: j.description, // full JD read off the page
        tags: [],
        postedAt: j.postedAt,
      });
    }

    _lastCrawl = { at: Date.now(), query: q, hits: hits.length, pagesRead, jobs: out.length };
    logger.info("web_crawl.done", { q, hits: hits.length, pagesRead, jobs: out.length });
    return out.slice(0, query.limit ?? 30);
  }
}
