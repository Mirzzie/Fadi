import { ATS_SEED } from "@/lib/jobs/ats-seed";
import { getCountry } from "@/lib/jobs/locations";
import { surfForJobs } from "@/lib/jobs/web-surfer";

import type { DataSourceCapability, JobPosting, JobSource, SignalQuery } from "../types";

// The Web Surfer as a first-class, ALWAYS-ON source: on every live pull it sweeps a set of
// verified company career boards (Greenhouse/Lever) — the open web no API covers — and returns
// their CURRENT openings. ATS boards only list open roles, so these are fresh by construction
// (no expired-job noise). No key, no bot wall. Tech-leaning seed → coverage "tech" so non-tech
// users aren't fed software roles. Runs alongside the APIs under discoverJobs.
export class WebSurferSource implements JobSource {
  readonly id = "web-surfer";
  readonly name = "Fadi Web Surfer (career pages + ATS)";
  readonly capabilities: DataSourceCapability[] = ["job_listings"];
  readonly cost = "free" as const;
  readonly coverage = "tech" as const;
  readonly isConfigured = true;

  async fetchJobs(query: SignalQuery): Promise<JobPosting[]> {
    const results = await Promise.allSettled(ATS_SEED.map((b) => surfForJobs(`${b.kind}:${b.token}`)));

    const kws = (query.keywords ?? []).map((k) => k.toLowerCase()).filter(Boolean);
    const countryName = query.country ? getCountry(query.country)?.name?.toLowerCase() : undefined;
    const city = query.city?.toLowerCase();
    const wantsLocation = Boolean(city || countryName);

    const out: JobPosting[] = [];
    results.forEach((res, i) => {
      if (res.status !== "fulfilled" || !res.value.ok) return;
      const company = ATS_SEED[i].company;
      for (const j of res.value.jobs) {
        const hay = `${j.title} ${j.description ?? ""}`.toLowerCase();
        const loc = (j.location ?? "").toLowerCase();
        const isRemote = /\bremote\b|anywhere|work from home|wfh/.test(loc);
        // Remote that isn't pinned to a DIFFERENT country — so "Remote, EMEA" counts for an
        // Ireland search but "Remote in the US" does not.
        const remoteAnywhere = isRemote && /\banywhere\b|worldwide|\bglobal\b|\bemea\b|\beurope\b/.test(loc);

        // Role gate: at least one keyword must appear (skip when none supplied).
        if (kws.length && !kws.some((k) => hay.includes(k))) continue;
        // Location gate: match the city, the country, or a location-agnostic remote role.
        // Skipped when the user searched worldwide (no location) — then everything qualifies.
        if (wantsLocation) {
          const matches =
            (city && loc.includes(city)) || (countryName && loc.includes(countryName)) || remoteAnywhere;
          if (!matches) continue;
        }
        if (query.remoteOnly && !isRemote) continue;

        out.push({
          sourceId: this.id,
          externalId: (j.url ?? `${company}:${j.title}`).slice(0, 250),
          title: j.title,
          company: j.company || company,
          location: j.location,
          remote: isRemote || undefined,
          url: j.url,
          description: j.description,
          tags: [],
          postedAt: j.postedAt,
        });
      }
    });

    // Freshest first, then cap.
    out.sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""));
    return out.slice(0, query.limit ?? 40);
  }
}
