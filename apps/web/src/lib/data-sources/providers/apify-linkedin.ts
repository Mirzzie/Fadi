/**
 * Apify — OPT-IN LinkedIn job scraping via the Curious Coder "LinkedIn Jobs
 * Scraper" actor (configurable). DEFAULT OFF: only active when APIFY_TOKEN is
 * set, and the operator owns the ToS/legal decision (LinkedIn's terms prohibit
 * scraping). Paid (Apify compute). Kept behind the same pluggable seam as every
 * other source so it can be switched off entirely.
 *
 * Run-sync API: POST /v2/acts/{actor}/run-sync-get-dataset-items?token=...
 * Actor input/output schemas vary, so the normalizer is deliberately defensive.
 */

import { getCountry } from "@/lib/jobs/locations";

import { htmlToText } from "../sanitize";
import type { DataSourceCapability, JobPosting, JobSource, SignalQuery } from "../types";

const DEFAULT_ACTOR = "curious_coder~linkedin-jobs-scraper";

// A LinkedIn-jobs dataset item — fields differ across actors/versions, so every
// field is optional and we read the common aliases.
type ApifyJobItem = {
  id?: string | number;
  jobId?: string | number;
  title?: string;
  jobTitle?: string;
  companyName?: string;
  company?: string;
  location?: string;
  jobUrl?: string;
  link?: string;
  url?: string;
  description?: string;
  descriptionText?: string;
  postedAt?: string;
  postedTime?: string;
  listedAt?: string | number;
  employmentType?: string;
};

function first<T>(...vals: (T | undefined | null)[]): T | undefined {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return undefined;
}

function toIso(v?: string | number): string | undefined {
  if (v === undefined) return undefined;
  const d = typeof v === "number" ? new Date(v) : new Date(v);
  return Number.isNaN(d.getTime()) ? (typeof v === "string" ? v : undefined) : d.toISOString();
}

/** Pure: normalize Apify dataset items → JobPostings (unit-tested). */
export function normalizeApifyJobs(items: ApifyJobItem[], sourceId = "apify_linkedin"): JobPosting[] {
  return (items ?? [])
    .map((it): JobPosting | null => {
      const title = first(it.title, it.jobTitle);
      const company = first(it.companyName, it.company);
      const url = first(it.jobUrl, it.link, it.url);
      if (!title || !company) return null;
      const location = it.location;
      return {
        sourceId,
        externalId: String(first(it.id, it.jobId, url, `${company}:${title}`)),
        title: title.trim(),
        company: company.trim(),
        location,
        remote: /remote/i.test(location ?? "") || /remote/i.test(title),
        url,
        description: htmlToText(first(it.descriptionText, it.description)),
        tags: it.employmentType ? [it.employmentType.toLowerCase()] : [],
        postedAt: toIso(first(it.postedAt, it.postedTime, it.listedAt)),
      };
    })
    .filter((j): j is JobPosting => j !== null);
}

export class ApifyLinkedInSource implements JobSource {
  readonly id = "apify_linkedin";
  readonly name = "LinkedIn via Apify (opt-in)";
  readonly capabilities: DataSourceCapability[] = ["job_listings"];
  readonly cost = "paid" as const;
  readonly isConfigured: boolean;

  constructor(
    private readonly token?: string,
    private readonly actor: string = DEFAULT_ACTOR,
  ) {
    this.isConfigured = Boolean(token);
  }

  async fetchJobs(query: SignalQuery): Promise<JobPosting[]> {
    if (!this.isConfigured) return [];

    const keywords = query.keywords.slice(0, 4).filter(Boolean).join(" ");
    const location = query.city ?? getCountry(query.country)?.name ?? "";
    const count = Math.min(query.limit ?? 20, 50);

    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
      keywords,
    )}${location ? `&location=${encodeURIComponent(location)}` : ""}`;

    // Superset input — common across LinkedIn-jobs actors; harmless extras are ignored.
    const input = { urls: [searchUrl], count, rows: count, keywords, location, scrapeJobDetails: true };

    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/${this.actor}/run-sync-get-dataset-items?token=${this.token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(60_000), // scraping runs are slow
        },
      );
      if (!res.ok) return [];
      const items = (await res.json()) as ApifyJobItem[];
      return normalizeApifyJobs(Array.isArray(items) ? items : [], this.id).slice(0, count);
    } catch {
      return [];
    }
  }
}
