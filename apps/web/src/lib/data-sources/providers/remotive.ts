/**
 * Remotive — live remote job listings. Free, no key, single JSON endpoint.
 * A simple, honest reference implementation of the JobSource contract; richer
 * sources (Adzuna, JSearch, direct ATS feeds for liveness) plug in the same way.
 * https://remotive.com/api/remote-jobs
 */

import { htmlToText } from "../sanitize";
import type { DataSourceCapability, JobPosting, SignalQuery, JobSource } from "../types";

const REMOTIVE_API = "https://remotive.com/api/remote-jobs";

type RemotiveJob = {
  id: number;
  title?: string;
  company_name?: string;
  candidate_required_location?: string;
  url?: string;
  description?: string;
  tags?: string[];
  publication_date?: string;
};

export class RemotiveSource implements JobSource {
  readonly id = "remotive";
  readonly name = "Remotive (remote jobs)";
  readonly isConfigured = true; // keyless
  readonly capabilities: DataSourceCapability[] = ["job_listings"];
  readonly cost = "free" as const;

  async fetchJobs(query: SignalQuery): Promise<JobPosting[]> {
    const search = query.keywords.slice(0, 3).filter(Boolean).join(" ");
    const params = new URLSearchParams({ limit: String(Math.min(query.limit ?? 20, 50)) });
    if (search) params.set("search", search);

    try {
      const res = await fetch(`${REMOTIVE_API}?${params}`, {
        headers: { "User-Agent": "CareerOS/1.0 (career intelligence)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];

      const data = (await res.json()) as { jobs?: RemotiveJob[] };
      return (data.jobs ?? [])
        .filter((j) => j.title && j.company_name)
        .map((j) => ({
          sourceId: this.id,
          externalId: String(j.id),
          title: j.title!.trim(),
          company: j.company_name!.trim(),
          location: j.candidate_required_location,
          remote: true,
          url: j.url,
          description: htmlToText(j.description),
          tags: j.tags ?? [],
          postedAt: j.publication_date,
        }));
    } catch {
      return [];
    }
  }
}
