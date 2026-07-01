/**
 * Reed.co.uk — one of the largest UK + Ireland job boards, with salary data.
 * Free API key. Auth is HTTP Basic with the key as the username and an empty
 * password. Crucially covers Ireland (Dublin), which Adzuna does not.
 * https://www.reed.co.uk/developers/jobseeker
 */

import { getCountry } from "@/lib/jobs/locations";

import { htmlToText } from "../sanitize";
import type { DataSourceCapability, JobPosting, SignalQuery, JobSource } from "../types";

const REED_API = "https://www.reed.co.uk/api/1.0/search";

type ReedJob = {
  jobId?: number;
  employerName?: string;
  jobTitle?: string;
  locationName?: string;
  minimumSalary?: number;
  maximumSalary?: number;
  currency?: string;
  jobUrl?: string;
  jobDescription?: string;
  date?: string; // "DD/MM/YYYY"
};

/** Reed dates are "DD/MM/YYYY"; convert to ISO, best-effort. */
function reedDateToIso(date?: string): string | undefined {
  if (!date) return undefined;
  const m = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  const iso = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
  return Number.isNaN(iso.getTime()) ? undefined : iso.toISOString();
}

function formatSalary(j: ReedJob): string | undefined {
  if (!j.minimumSalary && !j.maximumSalary) return undefined;
  const cur = j.currency === "EUR" ? "€" : j.currency === "USD" ? "$" : "£";
  const fmt = (n: number) => `${cur}${Math.round(n / 1000)}k`;
  if (j.minimumSalary && j.maximumSalary && j.minimumSalary !== j.maximumSalary) {
    return `${fmt(j.minimumSalary)}–${fmt(j.maximumSalary)}`;
  }
  return fmt(j.maximumSalary ?? j.minimumSalary!);
}

export class ReedSource implements JobSource {
  readonly id = "reed";
  readonly name = "Reed (UK + Ireland, salary)";
  readonly capabilities: DataSourceCapability[] = ["job_listings", "salary"];
  readonly cost = "free" as const;
  readonly isConfigured: boolean;

  constructor(private readonly apiKey?: string) {
    this.isConfigured = Boolean(apiKey);
  }

  async fetchJobs(query: SignalQuery): Promise<JobPosting[]> {
    if (!this.isConfigured) return [];

    const keywords = query.keywords.slice(0, 4).filter(Boolean).join(" ");
    const params = new URLSearchParams({
      resultsToTake: String(Math.min(query.limit ?? 20, 100)),
    });
    if (keywords) params.set("keywords", keywords);
    const locationName = query.city ?? getCountry(query.country)?.name;
    if (locationName) params.set("locationName", locationName);

    // Basic auth: username = API key, password = empty.
    const auth = Buffer.from(`${this.apiKey}:`).toString("base64");

    try {
      const res = await fetch(`${REED_API}?${params}`, {
        headers: {
          Authorization: `Basic ${auth}`,
          "User-Agent": "Fadi/1.0 (career intelligence)",
        },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return [];

      const data = (await res.json()) as { results?: ReedJob[] };
      return (data.results ?? [])
        .filter((j) => j.jobTitle && j.employerName)
        .map((j) => ({
          sourceId: this.id,
          externalId: String(j.jobId),
          title: j.jobTitle!.trim(),
          company: j.employerName!.trim(),
          location: j.locationName,
          remote: /remote/i.test(j.locationName ?? "") || /remote/i.test(j.jobTitle ?? ""),
          url: j.jobUrl,
          description: htmlToText(j.jobDescription),
          tags: [],
          postedAt: reedDateToIso(j.date),
          salaryText: formatSalary(j),
        }));
    } catch {
      return [];
    }
  }
}
