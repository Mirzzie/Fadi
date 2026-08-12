/**
 * The Muse — a real, cross-industry job API that is FREE and KEYLESS. Server-side searchable by
 * location, covers Ireland and every field (not just tech), returns the full JD. This is the
 * zero-budget coverage win: no signup, no card, no quota gymnastics.
 * https://www.themuse.com/developers/api/v2
 */

import { getCountry } from "@/lib/jobs/locations";

import { htmlToText } from "../sanitize";
import type { DataSourceCapability, JobPosting, JobSource, SignalQuery } from "../types";

type MuseJob = {
  name?: string;
  company?: { name?: string };
  locations?: { name?: string }[];
  contents?: string;
  refs?: { landing_page?: string };
  publication_date?: string;
};

export class MuseSource implements JobSource {
  readonly id = "themuse";
  readonly name = "The Muse (free, keyless)";
  readonly isConfigured = true; // no key, ever
  readonly capabilities: DataSourceCapability[] = ["job_listings"];
  readonly cost = "free" as const;
  readonly coverage = "general" as const; // all industries — helps non-tech users too

  async fetchJobs(query: SignalQuery): Promise<JobPosting[]> {
    try {
      const params = new URLSearchParams({ page: "1" });
      // Server-side location filter, "City, Country" (e.g. "Dublin, Ireland"). Omitted when the
      // user searches worldwide → global postings.
      const loc = [query.city, query.country ? getCountry(query.country)?.name : undefined]
        .filter(Boolean)
        .join(", ");
      if (loc) params.set("location", loc);

      const res = await fetch(`https://www.themuse.com/api/public/jobs?${params}`, {
        headers: { "User-Agent": "Fadi/1.0 (career intelligence)" },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) return [];

      const data = (await res.json()) as { results?: MuseJob[] };
      const all = (data.results ?? []).filter((j) => j.name && j.company?.name);

      // The location filter already scoped the set; narrow by keywords, but keep the location
      // matches even if keywords are thin (better a relevant-place job than nothing).
      const terms = query.keywords.map((k) => k.toLowerCase()).filter(Boolean);
      const matched = terms.length
        ? all.filter((j) => {
            const hay = `${j.name} ${htmlToText(j.contents ?? "")}`.toLowerCase();
            return terms.some((t) => hay.includes(t));
          })
        : all;
      const chosen = matched.length > 0 ? matched : all;

      return chosen.slice(0, Math.min(query.limit ?? 20, 40)).map((j) => ({
        sourceId: this.id,
        externalId: (j.refs?.landing_page ?? `${j.company!.name}-${j.name}`).slice(0, 250),
        title: j.name!.trim(),
        company: j.company!.name!.trim(),
        location: j.locations?.[0]?.name,
        url: j.refs?.landing_page,
        description: htmlToText(j.contents ?? "").slice(0, 4000) || undefined,
        tags: [],
        postedAt: j.publication_date,
      }));
    } catch {
      return [];
    }
  }
}
