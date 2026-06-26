/**
 * Direct ATS board feeds — Greenhouse, Lever, and Ashby public job-board APIs.
 *
 * Why this is better than keyword aggregators (the technique adapted from
 * career-ops, santifer/career-ops, MIT): postings come STRAIGHT from the
 * employer's applicant-tracking system, so they're fresh and far less ghost-prone
 * than a re-indexed aggregator, and the feeds are keyless + cross-industry (these
 * ATSs host hospitals, banks, retailers — not just tech). It's company-driven, not
 * keyword-driven: you point it at a company you care about and get its live roles.
 *
 * Endpoints + field mappings credited to career-ops's provider modules
 * (providers/greenhouse.mjs, lever.mjs, ashby.mjs):
 *   Greenhouse  https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
 *   Lever       https://api.lever.co/v0/postings/{slug}?mode=json
 *   Ashby       https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true
 *
 * Pure helpers (companySlugs / map*) are unit-testable; the fetchers do bounded,
 * best-effort I/O and never throw.
 */

import { htmlToText } from "./sanitize";
import type { JobPosting } from "./types";

export type AtsProvider = "greenhouse" | "lever" | "ashby";

const LEGAL_SUFFIX = /\b(inc|inc\.|llc|l\.l\.c|ltd|ltd\.|limited|corp|corporation|co|gmbh|plc|sa|ag|bv|pty)\b/gi;

/**
 * Candidate ATS slugs for a company name. We can't read a slug directory, so we
 * derive the common forms (most ATS slugs are the name, lowercased, with spaces
 * removed or hyphenated). Best-effort: a miss just returns nothing for that board.
 */
export function companySlugs(company: string): string[] {
  const base = company
    .toLowerCase()
    .replace(LEGAL_SUFFIX, " ")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "") // drop apostrophes so "jerry's" → "jerrys", not "jerry-s"
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (!base) return [];
  const compact = base.replace(/[\s-]+/g, "");
  const hyphen = base.replace(/\s+/g, "-");
  return [...new Set([compact, hyphen].filter((s) => s.length >= 2))];
}

export const atsUrl: Record<AtsProvider, (slug: string) => string> = {
  greenhouse: (slug) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
  lever: (slug) => `https://api.lever.co/v0/postings/${slug}?mode=json`,
  ashby: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`,
};

// ── Pure response mappers (testable with sample payloads) ───────────────────────

export function mapGreenhouse(json: unknown, company: string): JobPosting[] {
  const jobs = (json as { jobs?: Array<Record<string, unknown>> })?.jobs ?? [];
  return jobs
    .filter((j) => j.title && j.absolute_url)
    .map((j) => ({
      sourceId: "ats:greenhouse",
      externalId: String(j.id ?? j.absolute_url),
      title: String(j.title).trim(),
      company,
      location: (j.location as { name?: string } | undefined)?.name || undefined,
      url: String(j.absolute_url),
      description: htmlToText(j.content as string | undefined) || undefined,
      tags: [],
      postedAt: (j.first_published as string) || (j.updated_at as string) || undefined,
    }));
}

export function mapLever(json: unknown, company: string): JobPosting[] {
  const postings = Array.isArray(json) ? (json as Array<Record<string, unknown>>) : [];
  return postings
    .filter((p) => p.text && p.hostedUrl)
    .map((p) => {
      const categories = (p.categories as Record<string, string> | undefined) ?? {};
      const created = typeof p.createdAt === "number" ? new Date(p.createdAt).toISOString() : undefined;
      return {
        sourceId: "ats:lever",
        externalId: String(p.id ?? p.hostedUrl),
        title: String(p.text).trim(),
        company,
        location: categories.location || undefined,
        url: String(p.hostedUrl),
        description: (p.descriptionPlain as string) || undefined,
        tags: [categories.team, categories.commitment].filter(Boolean) as string[],
        postedAt: created,
      };
    });
}

export function mapAshby(json: unknown, company: string): JobPosting[] {
  const jobs = (json as { jobs?: Array<Record<string, unknown>> })?.jobs ?? [];
  return jobs
    .filter((j) => j.title && j.jobUrl)
    .map((j) => {
      const comp = j.compensation as
        | { minValue?: number; maxValue?: number; currency?: string; interval?: string }
        | undefined;
      const salaryText =
        comp?.minValue && comp?.maxValue
          ? `${comp.currency ?? ""} ${comp.minValue}–${comp.maxValue}/${(comp.interval ?? "").replace(/^1 /, "")}`.trim()
          : undefined;
      return {
        sourceId: "ats:ashby",
        externalId: String(j.id ?? j.jobUrl),
        title: String(j.title).trim(),
        company,
        location: (j.location as string) || undefined,
        remote: Boolean(j.isRemote),
        url: String(j.jobUrl),
        description: (j.descriptionPlain as string) || undefined,
        tags: [],
        postedAt: (j.publishedAt as string) || undefined,
        salaryText,
      };
    });
}

const MAPPERS: Record<AtsProvider, (json: unknown, company: string) => JobPosting[]> = {
  greenhouse: mapGreenhouse,
  lever: mapLever,
  ashby: mapAshby,
};

async function fetchBoard(provider: AtsProvider, slug: string, company: string): Promise<JobPosting[]> {
  try {
    const res = await fetch(atsUrl[provider](slug), {
      headers: { "User-Agent": "FadiOS/1.0 (career intelligence)", Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    return MAPPERS[provider](await res.json(), company);
  } catch {
    return [];
  }
}

/** Keep only roles whose title matches any of the role keywords (when provided). */
export function filterByRole(jobs: JobPosting[], keywords: string[]): JobPosting[] {
  const terms = keywords.map((k) => k.toLowerCase().trim()).filter((k) => k.length > 1);
  if (terms.length === 0) return jobs;
  return jobs.filter((j) => {
    const t = j.title.toLowerCase();
    return terms.some((term) => t.includes(term));
  });
}

export type CompanyAtsResult = { company: string; provider: AtsProvider | null; jobs: JobPosting[] };

/**
 * Pull a company's live roles straight from its ATS board. Tries each slug
 * candidate across Greenhouse → Lever → Ashby and returns the first board that
 * answers with roles. Best-effort: an unknown company yields an empty result
 * (honest — we don't fabricate listings).
 */
export async function fetchCompanyAtsJobs(
  company: string,
  opts: { keywords?: string[]; limit?: number } = {},
): Promise<CompanyAtsResult> {
  const slugs = companySlugs(company);
  const providers: AtsProvider[] = ["greenhouse", "lever", "ashby"];
  for (const slug of slugs) {
    for (const provider of providers) {
      const jobs = await fetchBoard(provider, slug, company);
      if (jobs.length > 0) {
        const filtered = filterByRole(jobs, opts.keywords ?? []).slice(0, opts.limit ?? 25);
        if (filtered.length > 0) return { company, provider, jobs: filtered };
      }
    }
  }
  return { company, provider: null, jobs: [] };
}
