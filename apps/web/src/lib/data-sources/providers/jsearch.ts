/**
 * JSearch (RapidAPI) — aggregates Google for Jobs, which surfaces postings that
 * originate on LinkedIn, Indeed, Glassdoor, ZipRecruiter and company sites — the
 * compliant way to get those listings without scraping. Cross-sector (any
 * field), global. Free tier + paid plans. Key: JSEARCH_RAPIDAPI_KEY.
 * https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
 */

import { getCountry } from "@/lib/jobs/locations";

import { htmlToText } from "../sanitize";
import type { DataSourceCapability, JobPosting, JobSource, SignalQuery } from "../types";

const JSEARCH_API = "https://jsearch.p.rapidapi.com/search";

type JSearchJob = {
  job_id?: string;
  employer_name?: string;
  job_title?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_is_remote?: boolean;
  job_apply_link?: string;
  job_google_link?: string;
  job_description?: string;
  job_posted_at_datetime_utc?: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
  job_employment_type?: string;
};

function formatSalary(j: JSearchJob): string | undefined {
  if (!j.job_min_salary && !j.job_max_salary) return undefined;
  const cur = j.job_salary_currency === "EUR" ? "€" : j.job_salary_currency === "GBP" ? "£" : "$";
  const fmt = (n: number) => `${cur}${Math.round(n / 1000)}k`;
  if (j.job_min_salary && j.job_max_salary && j.job_min_salary !== j.job_max_salary) {
    return `${fmt(j.job_min_salary)}–${fmt(j.job_max_salary)}`;
  }
  return fmt(j.job_max_salary ?? j.job_min_salary!);
}

/** Pure: map a JSearch API payload to normalized JobPostings (unit-tested). */
export function normalizeJSearch(data: { data?: JSearchJob[] }, sourceId = "jsearch"): JobPosting[] {
  return (data.data ?? [])
    .filter((j) => j.job_title && j.employer_name)
    .map((j) => ({
      sourceId,
      externalId: String(j.job_id ?? `${j.employer_name}:${j.job_title}`),
      title: j.job_title!.trim(),
      company: j.employer_name!.trim(),
      location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", ") || undefined,
      remote: Boolean(j.job_is_remote),
      url: j.job_apply_link ?? j.job_google_link,
      description: htmlToText(j.job_description),
      tags: j.job_employment_type ? [j.job_employment_type.toLowerCase()] : [],
      postedAt: j.job_posted_at_datetime_utc,
      salaryText: formatSalary(j),
    }));
}

export class JSearchSource implements JobSource {
  readonly id = "jsearch";
  readonly name = "JSearch (Google for Jobs — LinkedIn/Indeed/etc.)";
  readonly capabilities: DataSourceCapability[] = ["job_listings", "salary"];
  readonly cost = "freemium" as const;
  readonly isConfigured: boolean;

  constructor(private readonly apiKey?: string) {
    this.isConfigured = Boolean(apiKey);
  }

  async fetchJobs(query: SignalQuery): Promise<JobPosting[]> {
    if (!this.isConfigured) return [];

    const keywords = query.keywords.slice(0, 4).filter(Boolean).join(" ");
    const where = query.city ?? getCountry(query.country)?.name ?? "";
    const q = [keywords, where && `in ${where}`].filter(Boolean).join(" ").trim() || "jobs";

    const params = new URLSearchParams({ query: q, page: "1", num_pages: "1" });
    if (query.country) params.set("country", query.country);

    try {
      const res = await fetch(`${JSEARCH_API}?${params}`, {
        headers: {
          "X-RapidAPI-Key": this.apiKey!,
          "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
          "User-Agent": "CareerOS/1.0 (career intelligence)",
        },
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { data?: JSearchJob[] };
      return normalizeJSearch(data, this.id).slice(0, query.limit ?? 20);
    } catch {
      return [];
    }
  }
}
