/**
 * Adzuna — job aggregator across ~19 countries, with salary data and
 * country/city filtering. Free developer key (app_id + app_key), attribution
 * required. This is how we get LinkedIn/Indeed/Glassdoor-grade breadth legally:
 * Adzuna already crawls + dedupes those sources. NOTE: Adzuna does NOT cover
 * Ireland — IE falls back to the keyless EU/remote sources + JSearch.
 * https://developer.adzuna.com/
 */

import { htmlToText } from "../sanitize";
import type { DataSourceCapability, JobPosting, SignalQuery, JobSource } from "../types";

const ADZUNA_API = "https://api.adzuna.com/v1/api/jobs";
const DEFAULT_COUNTRY = "gb";

type AdzunaResult = {
  id?: string;
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  redirect_url?: string;
  description?: string;
  created?: string; // ISO
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
  contract_time?: string; // full_time | part_time
  category?: { label?: string };
};

function formatSalary(r: AdzunaResult): string | undefined {
  if (!r.salary_min && !r.salary_max) return undefined;
  const fmt = (n: number) => `${Math.round(n / 1000)}k`;
  const predicted = r.salary_is_predicted === "1" ? " (est.)" : "";
  if (r.salary_min && r.salary_max && r.salary_min !== r.salary_max) {
    return `${fmt(r.salary_min)}–${fmt(r.salary_max)}${predicted}`;
  }
  const one = r.salary_max ?? r.salary_min!;
  return `${fmt(one)}${predicted}`;
}

export class AdzunaSource implements JobSource {
  readonly id = "adzuna";
  readonly name = "Adzuna (aggregator + salary)";
  readonly capabilities: DataSourceCapability[] = ["job_listings", "salary"];
  readonly cost = "freemium" as const;
  readonly isConfigured: boolean;

  constructor(
    private readonly appId?: string,
    private readonly appKey?: string,
  ) {
    this.isConfigured = Boolean(appId && appKey);
  }

  async fetchJobs(query: SignalQuery): Promise<JobPosting[]> {
    if (!this.isConfigured) return [];

    const country = (query.country ?? DEFAULT_COUNTRY).toLowerCase();
    const what = query.keywords.slice(0, 4).filter(Boolean).join(" ");
    const limit = Math.min(query.limit ?? 20, 50);

    const params = new URLSearchParams({
      app_id: this.appId!,
      app_key: this.appKey!,
      results_per_page: String(limit),
      "content-type": "application/json",
    });
    if (what) params.set("what", what);
    if (query.city) params.set("where", query.city);

    try {
      const res = await fetch(`${ADZUNA_API}/${country}/search/1?${params}`, {
        headers: { "User-Agent": "FadiOS/1.0 (career intelligence)" },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return [];

      const data = (await res.json()) as { results?: AdzunaResult[] };
      return (data.results ?? [])
        .filter((r) => r.title && r.company?.display_name)
        .map((r) => ({
          sourceId: this.id,
          externalId: String(r.id ?? r.redirect_url),
          title: r.title!.trim(),
          company: r.company!.display_name!.trim(),
          location: r.location?.display_name,
          remote: /remote/i.test(r.location?.display_name ?? ""),
          url: r.redirect_url,
          description: htmlToText(r.description),
          tags: [r.category?.label, r.contract_time].filter(Boolean) as string[],
          postedAt: r.created,
          salaryText: formatSalary(r),
        }));
    } catch {
      return [];
    }
  }
}
