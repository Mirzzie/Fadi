/**
 * Job search filters — pure logic, no I/O.
 *
 * JobSpy exposes its filters as scraper *inputs* (`job_type`, `is_remote`,
 * `hours_old`, `distance`), pushed down to each board. Fadi needs both: push down
 * what a source supports, then apply the full set locally, because coverage is
 * uneven — LinkedIn honours a remote flag, Remotive has no salary filter at all,
 * and a scraped card often omits the very field being filtered on.
 *
 * The governing rule here is how to treat a posting that is MISSING the filtered
 * field. Dropping it hides real jobs (most boards omit salary); keeping it silently
 * makes the filter meaningless. So the caller chooses, per filter, via
 * `includeUnknown` — and the UI can then say "12 more with no salary listed"
 * instead of pretending they don't exist.
 */

import { annualizeSalary, normalizeJobType, type JobType } from "./normalize";
import type { JobPosting } from "./types";

export interface JobFilters {
  /** Free text matched against title, company, description and skills. */
  text?: string;
  /** Minimum pay, compared on an ANNUALIZED basis so intervals are comparable. */
  salaryMin?: number;
  /** Postings with no stated salary. Default true — most boards omit it. */
  includeUnknownSalary?: boolean;
  remoteOnly?: boolean;
  jobTypes?: JobType[];
  /** Maximum age in days, from `postedAt`. */
  maxAgeDays?: number;
  /** Postings with no stated date. Default true. */
  includeUndated?: boolean;
  /** Substring match against location; ignored for remote postings. */
  location?: string;
  companies?: string[];
  /** Any of these skills/tags present. */
  skills?: string[];
}

export type JobSortKey = "relevance" | "date" | "salary";

/** Why a posting was excluded — powers honest "N hidden by filter X" UI counts. */
export type FilterReason =
  | "text" | "salary" | "remote" | "jobType" | "age" | "location" | "company" | "skills";

export interface FilterOutcome {
  jobs: JobPosting[];
  /** Count excluded per filter, so the UI can explain an empty result set. */
  excluded: Partial<Record<FilterReason, number>>;
}

function haystack(job: JobPosting): string {
  return [
    job.title, job.company, job.location, job.description,
    ...(job.tags ?? []), ...(job.skills ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Annualized minimum pay, or null when the posting doesn't support comparison. */
function comparableSalary(job: JobPosting): number | null {
  return annualizeSalary(job.salaryMin, job.salaryInterval ?? null);
}

function ageInDays(job: JobPosting): number | null {
  if (!job.postedAt) return null;
  const ts = new Date(job.postedAt).getTime();
  if (Number.isNaN(ts)) return null;
  return (Date.now() - ts) / (1000 * 60 * 60 * 24);
}

/**
 * Apply filters, reporting what each one removed.
 *
 * Each posting is tested against every filter and attributed to the FIRST one that
 * rejects it, so the counts sum to the number removed rather than double-counting.
 */
export function filterJobs(jobs: JobPosting[], filters: JobFilters): FilterOutcome {
  const excluded: Partial<Record<FilterReason, number>> = {};
  const reject = (reason: FilterReason) => {
    excluded[reason] = (excluded[reason] ?? 0) + 1;
    return false;
  };

  const includeUnknownSalary = filters.includeUnknownSalary ?? true;
  const includeUndated = filters.includeUndated ?? true;
  const text = filters.text?.trim().toLowerCase();
  const terms = text ? text.split(/\s+/).filter(Boolean) : [];

  const kept = jobs.filter((job) => {
    const hay = haystack(job);

    // Every term must appear somewhere — AND, not OR, so adding a word narrows.
    if (terms.length > 0 && !terms.every((t) => hay.includes(t))) return reject("text");

    if (filters.salaryMin != null) {
      const salary = comparableSalary(job);
      if (salary == null) {
        if (!includeUnknownSalary) return reject("salary");
      } else if (salary < filters.salaryMin) {
        return reject("salary");
      }
    }

    if (filters.remoteOnly && !job.remote) return reject("remote");

    if (filters.jobTypes && filters.jobTypes.length > 0) {
      // Job type isn't a first-class field on JobPosting, so read it from the
      // tags the source supplied — that's where boards put employment type.
      const declared = (job.tags ?? [])
        .map((t) => normalizeJobType(t))
        .filter((t): t is JobType => t != null);
      if (declared.length > 0 && !declared.some((t) => filters.jobTypes!.includes(t))) {
        return reject("jobType");
      }
    }

    if (filters.maxAgeDays != null) {
      const age = ageInDays(job);
      if (age == null) {
        if (!includeUndated) return reject("age");
      } else if (age > filters.maxAgeDays) {
        return reject("age");
      }
    }

    if (filters.location) {
      const wanted = filters.location.toLowerCase().trim();
      // A remote job satisfies any location filter — that is the point of remote.
      const matches = job.remote || (job.location ?? "").toLowerCase().includes(wanted);
      if (!matches) return reject("location");
    }

    if (filters.companies && filters.companies.length > 0) {
      const company = job.company.toLowerCase();
      if (!filters.companies.some((c) => company.includes(c.toLowerCase()))) {
        return reject("company");
      }
    }

    if (filters.skills && filters.skills.length > 0) {
      if (!filters.skills.some((s) => hay.includes(s.toLowerCase()))) return reject("skills");
    }

    return true;
  });

  return { jobs: kept, excluded };
}

/**
 * Sort a result set. `relevance` preserves the incoming order, which is already
 * the round-robin/scored order the caller established — re-sorting would discard it.
 *
 * Postings missing the sort field always sink to the bottom rather than being
 * treated as zero, so "sort by salary" doesn't bury the paying jobs under
 * everything that failed to state a number.
 */
export function sortJobs(jobs: JobPosting[], key: JobSortKey): JobPosting[] {
  if (key === "relevance") return [...jobs];

  const sorted = [...jobs];
  if (key === "salary") {
    sorted.sort((a, b) => {
      const sa = comparableSalary(a);
      const sb = comparableSalary(b);
      if (sa == null && sb == null) return 0;
      if (sa == null) return 1;
      if (sb == null) return -1;
      return sb - sa;
    });
    return sorted;
  }

  sorted.sort((a, b) => {
    const ta = a.postedAt ? new Date(a.postedAt).getTime() : NaN;
    const tb = b.postedAt ? new Date(b.postedAt).getTime() : NaN;
    const va = Number.isNaN(ta);
    const vb = Number.isNaN(tb);
    if (va && vb) return 0;
    if (va) return 1;
    if (vb) return -1;
    return tb - ta;
  });
  return sorted;
}

/** Facet counts for the filter UI, computed over the UNFILTERED set. */
export function jobFacets(jobs: JobPosting[]): {
  total: number;
  remote: number;
  withSalary: number;
  companies: Array<{ name: string; count: number }>;
  sources: Array<{ id: string; count: number }>;
} {
  const companies = new Map<string, number>();
  const sources = new Map<string, number>();
  let remote = 0;
  let withSalary = 0;

  for (const job of jobs) {
    if (job.remote) remote++;
    if (comparableSalary(job) != null) withSalary++;
    companies.set(job.company, (companies.get(job.company) ?? 0) + 1);
    sources.set(job.sourceId, (sources.get(job.sourceId) ?? 0) + 1);
  }

  const byCount = <T extends { count: number }>(a: T, b: T) => b.count - a.count;

  return {
    total: jobs.length,
    remote,
    withSalary,
    companies: [...companies].map(([name, count]) => ({ name, count })).sort(byCount).slice(0, 20),
    sources: [...sources].map(([id, count]) => ({ id, count })).sort(byCount),
  };
}
