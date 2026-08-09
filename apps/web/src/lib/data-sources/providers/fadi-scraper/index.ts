import type { DataSourceCapability, JobPosting, JobSource, SignalQuery } from "../../types";

import { RECIPES, recordToPosting } from "./recipes";

/**
 * Fadi Job Scraper — Fadi's own browser-automation source that job-hunts like a human across
 * sites without APIs (the long tail: niche boards, company career pages). It implements the
 * standard JobSource contract, so `discoverJobs()` runs it alongside every API provider and
 * merges/dedupes the results — it's under the central engine, not a separate flow.
 *
 * OFF by default (heavy + maintenance-prone). Enable with FADI_SCRAPER_ENABLED=1 once
 * Playwright + a browser are installed. When disabled or on any failure it returns [] so the
 * rest of the search is unaffected. Registered LAST so the dedupe (first-wins) keeps licensed
 * API attribution over the scraper.
 */
export class FadiScraperSource implements JobSource {
  readonly id = "fadi-scraper";
  readonly name = "Fadi Job Scraper (browser automation)";
  readonly capabilities: DataSourceCapability[] = ["job_listings"];
  readonly cost = "free" as const;
  readonly isConfigured: boolean;

  constructor(enabled?: boolean) {
    this.isConfigured = Boolean(enabled);
  }

  async fetchJobs(query: SignalQuery): Promise<JobPosting[]> {
    if (!this.isConfigured) return [];
    const limit = query.limit ?? 20;
    try {
      // Dynamic imports keep Playwright/AI out of the bundle unless the scraper actually runs.
      const [{ scrapeRecipe, scrapePageText }, { aiExtractJobs }] = await Promise.all([
        import("./browser"),
        import("./ai-extract"),
      ]);
      const settled = await Promise.allSettled(
        RECIPES.map(async (r) => {
          // AI mode (default): render → LLM extracts (self-healing). Else CSS selectors.
          if (r.mode !== "selectors") {
            const text = await scrapePageText(r, query);
            return aiExtractJobs(text, r.name);
          }
          return scrapeRecipe(r, query, limit);
        }),
      );
      const postings: JobPosting[] = [];
      settled.forEach((res, i) => {
        if (res.status !== "fulfilled") return;
        for (const rec of res.value) {
          const posting = recordToPosting(rec, RECIPES[i]);
          if (posting) postings.push(posting);
        }
      });
      return postings.slice(0, limit);
    } catch {
      return [];
    }
  }
}
