/**
 * Jooble — global job aggregator with a simple keyed API. Free key. Covers
 * Ireland and most countries, so it's our primary breadth source for regions
 * Adzuna omits. POST the key in the path with a JSON { keywords, location } body.
 * https://jooble.org/api/about
 */

import { getCountry } from "@/lib/jobs/locations";

import { htmlToText } from "../sanitize";
import type { DataSourceCapability, JobPosting, SignalQuery, JobSource } from "../types";

const JOOBLE_API = "https://jooble.org/api";

type JoobleJob = {
  id?: number | string;
  title?: string;
  location?: string;
  snippet?: string;
  salary?: string;
  source?: string;
  type?: string;
  link?: string;
  company?: string;
  updated?: string; // ISO
};

export class JoobleSource implements JobSource {
  readonly id = "jooble";
  readonly name = "Jooble (global aggregator)";
  readonly capabilities: DataSourceCapability[] = ["job_listings"];
  readonly cost = "free" as const;
  readonly isConfigured: boolean;

  constructor(private readonly apiKey?: string) {
    this.isConfigured = Boolean(apiKey);
  }

  async fetchJobs(query: SignalQuery): Promise<JobPosting[]> {
    if (!this.isConfigured) return [];

    const keywords = query.keywords.slice(0, 4).filter(Boolean).join(" ");
    // Qualify the city with its country — "Dublin" alone makes Jooble return
    // Dublin, California instead of Dublin, Ireland.
    const countryName = getCountry(query.country)?.name;
    const location = query.city
      ? countryName
        ? `${query.city}, ${countryName}`
        : query.city
      : (countryName ?? "");

    try {
      const res = await fetch(`${JOOBLE_API}/${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "FadiOS/1.0 (career intelligence)",
        },
        body: JSON.stringify({ keywords, location }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return [];

      const data = (await res.json()) as { jobs?: JoobleJob[] };
      return (data.jobs ?? [])
        .filter((j) => j.title && j.company)
        .slice(0, Math.min(query.limit ?? 20, 50))
        .map((j) => ({
          sourceId: this.id,
          externalId: String(j.id ?? j.link),
          title: j.title!.trim(),
          company: j.company!.trim(),
          location: j.location,
          remote: /remote/i.test(j.location ?? "") || /remote/i.test(j.title ?? ""),
          url: j.link,
          description: htmlToText(j.snippet),
          tags: [j.type].filter(Boolean) as string[],
          postedAt: j.updated,
          salaryText: j.salary || undefined,
        }));
    } catch {
      return [];
    }
  }
}
