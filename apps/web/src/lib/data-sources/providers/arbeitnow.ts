/**
 * Arbeitnow — EU + ATS-sourced job board. Free, no key, single JSON endpoint.
 * The public board API returns the most recent postings (not server-side
 * searchable), so we fetch the latest page and filter against the user's
 * keywords ourselves. Same honest JobSource contract as Remotive.
 * https://www.arbeitnow.com/api/job-board-api
 */

import { htmlToText } from "../sanitize";
import type { DataSourceCapability, JobPosting, SignalQuery, JobSource } from "../types";

const ARBEITNOW_API = "https://www.arbeitnow.com/api/job-board-api";

type ArbeitnowJob = {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number; // unix seconds
};

export class ArbeitnowSource implements JobSource {
  readonly id = "arbeitnow";
  readonly name = "Arbeitnow (EU / ATS jobs)";
  readonly isConfigured = true; // keyless
  readonly capabilities: DataSourceCapability[] = ["job_listings"];
  readonly cost = "free" as const;
  readonly coverage = "tech" as const; // predominantly IT/engineering ATS feed — dropped for non-tech users

  async fetchJobs(query: SignalQuery): Promise<JobPosting[]> {
    try {
      const res = await fetch(ARBEITNOW_API, {
        headers: { "User-Agent": "FadiOS/1.0 (career intelligence)" },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return [];

      const data = (await res.json()) as { data?: ArbeitnowJob[] };
      const all = (data.data ?? []).filter((j) => j.title && j.company_name);

      // The endpoint isn't searchable, so rank by keyword overlap and keep the
      // matches. With no usable keywords we still return the freshest postings
      // rather than nothing, so the pipeline stays visibly live.
      const terms = query.keywords.map((k) => k.toLowerCase()).filter(Boolean);
      const matches = terms.length
        ? all.filter((j) => {
            const hay = `${j.title} ${j.tags?.join(" ") ?? ""} ${j.description ?? ""}`.toLowerCase();
            return terms.some((t) => hay.includes(t));
          })
        : all;

      return matches.slice(0, Math.min(query.limit ?? 20, 50)).map((j) => ({
        sourceId: this.id,
        externalId: j.slug ?? j.url ?? `${j.company_name}-${j.title}`,
        title: j.title!.trim(),
        company: j.company_name!.trim(),
        location: j.location,
        remote: j.remote ?? false,
        url: j.url,
        description: htmlToText(j.description),
        tags: [...(j.tags ?? []), ...(j.job_types ?? [])],
        postedAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : undefined,
      }));
    } catch {
      return [];
    }
  }
}
