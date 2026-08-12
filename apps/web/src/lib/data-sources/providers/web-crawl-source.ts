import { getCountry } from "@/lib/jobs/locations";
import { searchJobUrls, webSearchConfigured } from "@/lib/jobs/web-search";
import { surfForJobs } from "@/lib/jobs/web-surfer";
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

    // 1) Discover — search the open web for job pages.
    const hits = await searchJobUrls(keywords, location, 12);
    logger.info("web_crawl.search", { q, hits: hits.length });
    if (hits.length === 0) {
      _lastCrawl = { at: Date.now(), query: q, hits: 0, pagesRead: 0, jobs: 0 };
      return [];
    }

    // 2) Visit + read + extract (non-expired, full JD) — every page in parallel.
    const visited = await Promise.allSettled(hits.map((h) => surfForJobs(h.url)));

    const out: JobPosting[] = [];
    let pagesRead = 0;
    visited.forEach((res, i) => {
      if (res.status !== "fulfilled" || !res.value.ok) return;
      pagesRead += 1;
      for (const j of res.value.jobs) {
        if (!j.title?.trim()) continue;
        let host = "";
        try {
          host = new URL(hits[i].url).hostname.replace(/^www\./, "");
        } catch {
          /* keep empty */
        }
        out.push({
          sourceId: this.id,
          externalId: (j.url ?? hits[i].url).slice(0, 250),
          title: j.title,
          company: j.company || host || "Unknown",
          location: j.location,
          url: j.url ?? hits[i].url,
          description: j.description, // full JD from the page
          tags: [],
          postedAt: j.postedAt,
        });
      }
    });

    _lastCrawl = { at: Date.now(), query: q, hits: hits.length, pagesRead, jobs: out.length };
    logger.info("web_crawl.done", { q, hits: hits.length, pagesRead, jobs: out.length });
    return out.slice(0, query.limit ?? 30);
  }
}
