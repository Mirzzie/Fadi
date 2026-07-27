/**
 * Job normalization — pure logic, no I/O.
 *
 * Ported from JobSpy's model layer (`jobspy/model.py` + each scraper's `util.py`).
 * Every board describes the same job differently: Indeed says "Fulltime", LinkedIn
 * says "Full-time", Reed says "Permanent"; one quotes £55,000/yr and another £28/hr.
 * Until those are reconciled, a "salary above £50k" filter is a lie and the same job
 * appears three times.
 *
 * This module is where that reconciliation happens, and it is deliberately pure so
 * every rule is testable without a network.
 */

import type { JobPosting } from "./types";

/** JobSpy's `JobType` vocabulary — the canonical set every source maps into. */
export type JobType =
  | "fulltime"
  | "parttime"
  | "contract"
  | "temporary"
  | "internship"
  | "perdiem"
  | "volunteer";

/**
 * Raw phrasings each board uses, mapped to the canonical type. Taken from JobSpy's
 * `JobType` enum, which accumulated these from real postings across eight boards —
 * including the non-English ones (Naukri, Bayt), hence "vollzeit"/"tiempo completo".
 */
const JOB_TYPE_SYNONYMS: Record<JobType, string[]> = {
  fulltime: [
    "fulltime", "full-time", "full time", "permanent", "vollzeit",
    "tiempo completo", "temps plein", "voltijds",
  ],
  parttime: ["parttime", "part-time", "part time", "teilzeit", "media jornada", "temps partiel"],
  contract: ["contract", "contractor", "contrato", "freelance", "b2b"],
  temporary: ["temporary", "temp", "interim", "seasonal", "befristet"],
  internship: ["internship", "intern", "trainee", "praktikum", "stage", "prácticas"],
  perdiem: ["perdiem", "per diem", "pro rata"],
  volunteer: ["volunteer", "voluntary"],
};

/**
 * Map a source's free-text employment string onto the canonical vocabulary.
 * Returns null rather than guessing — an unknown type must not silently become
 * "fulltime", or a contract-only filter would hand back permanent roles.
 */
export function normalizeJobType(raw: string | null | undefined): JobType | null {
  if (!raw) return null;
  // Collapse punctuation so "Full_Time", "FULL-TIME" and "full time" all converge.
  const text = raw.toLowerCase().replace(/[_\-/]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;

  for (const [type, synonyms] of Object.entries(JOB_TYPE_SYNONYMS) as [JobType, string[]][]) {
    for (const synonym of synonyms) {
      const normalized = synonym.replace(/[_\-/]+/g, " ");
      // Word-boundary match: "intern" must not fire on "internal communications".
      const pattern = new RegExp(`(^|\\s)${escapeRegex(normalized)}($|\\s)`);
      if (pattern.test(text)) return type;
    }
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** How many pay periods make a year — for converting any interval to annual. */
const PERIODS_PER_YEAR = {
  yearly: 1,
  monthly: 12,
  weekly: 52,
  // JobSpy assumes a 2080-hour work year (40h × 52w); daily follows at 260 days.
  daily: 260,
  hourly: 2080,
} as const;

export type SalaryInterval = keyof typeof PERIODS_PER_YEAR;

/**
 * Convert pay to an annual figure so postings quoted in different intervals can be
 * compared, filtered and sorted together. Without this, "£30/hour" sorts below
 * "£25,000/year" — and the £62k contract loses to the £25k job.
 *
 * Returns null when the interval is unknown; the caller must then treat the salary
 * as unfilterable rather than assume it is annual.
 */
export function annualizeSalary(
  amount: number | null | undefined,
  interval: SalaryInterval | null | undefined,
): number | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  if (!interval || !(interval in PERIODS_PER_YEAR)) return null;
  return Math.round(amount * PERIODS_PER_YEAR[interval]);
}

/**
 * Infer the pay interval when a source gives prose instead of a field.
 * JobSpy does this with a keyword scan of the salary string.
 */
export function inferSalaryInterval(text: string | null | undefined): SalaryInterval | null {
  if (!text) return null;
  const t = text.toLowerCase();

  // Two shapes, and they need different anchoring. Word forms ("per hour", "daily")
  // take \b on both sides. Slash forms ("/hr", "/ day") CANNOT: \b before "/" never
  // matches, because a space-to-slash transition isn't a word boundary — that silently
  // killed every slash form until a test caught it.
  const match = (words: string[], slashes: string[]): boolean =>
    new RegExp(`\\b(${words.join("|")})\\b`).test(t) ||
    (slashes.length > 0 && new RegExp(`/\\s*(${slashes.join("|")})\\b`).test(t));

  if (match(["per hour", "hourly", "an hour", "p/h"], ["hr", "hour"])) return "hourly";
  if (match(["per day", "daily", "a day", "per diem"], ["day"])) return "daily";
  if (match(["per week", "weekly", "a week"], ["week", "wk"])) return "weekly";
  if (match(["per month", "monthly", "a month", "pcm"], ["month", "mo"])) return "monthly";
  // "a year" is Indeed's own phrasing — omitting it left every Indeed salary
  // unannualized, and therefore invisible to the salary filter.
  if (
    match(["per year", "yearly", "annually", "annual", "a year", "per annum", "p\\.?a\\.?"], [
      "year",
      "yr",
    ])
  ) {
    return "yearly";
  }
  return null;
}

/**
 * Remote inference, ported from JobSpy's `is_job_remote`. Each scraper checks the
 * title, the location and the description for remote keywords, because most boards
 * have no reliable remote flag — Indeed's own attribute is frequently absent on
 * postings whose description opens with "100% remote".
 *
 * Conservative by design: "hybrid" is NOT remote, and neither is "remote office"
 * (an office named Remote, which shows up in real data).
 */
const REMOTE_KEYWORDS = ["remote", "work from home", "wfh", "telecommute", "fully distributed"];

export function inferRemote(fields: {
  title?: string | null;
  location?: string | null;
  description?: string | null;
}): boolean {
  const haystack = [fields.title, fields.location, fields.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!haystack) return false;
  // Hybrid is explicitly on-site-adjacent; treating it as remote frustrates anyone
  // filtering for genuinely location-free work.
  if (/\bhybrid\b/.test(haystack)) return false;
  return REMOTE_KEYWORDS.some((k) => haystack.includes(k));
}

/**
 * Canonical company name for dedupe: strips legal suffixes and punctuation so
 * "Acme, Inc.", "ACME Inc" and "Acme Limited" collapse to one entity.
 */
const LEGAL_SUFFIXES = [
  "inc", "incorporated", "llc", "ltd", "limited", "plc", "gmbh", "bv", "nv",
  "corp", "corporation", "co", "company", "sa", "srl", "pty", "ag", "as", "ab",
];

export function canonicalCompany(name: string): string {
  let s = name.toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  // Strip trailing legal suffixes repeatedly ("Acme Holdings Ltd Inc" → "acme holdings").
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of LEGAL_SUFFIXES) {
      const pattern = new RegExp(`\\s${suffix}$`);
      if (pattern.test(s)) {
        s = s.replace(pattern, "");
        changed = true;
      }
    }
  }
  return s.trim();
}

/**
 * Canonical title for dedupe: drops the decoration boards bolt on — req IDs,
 * location suffixes, gender tags (m/w/d on German postings), emoji.
 */
export function canonicalTitle(title: string): string {
  return title
    .toLowerCase()
    // "(m/w/d)", "(f/m/x)" — EU-compliance gender tags, pure noise for matching.
    .replace(/\([mfwdx](\s*\/\s*[mfwdx])+\)/g, " ")
    // Requisition IDs: "- REQ12345", "(JR-0092)".
    .replace(/[-(\[]\s*(req|jr|job|id)[\s#-]*\d+\s*[)\]]?/gi, " ")
    // Trailing location/department after a pipe or en-dash.
    .replace(/[|–—]/g, " ")
    .replace(/[^a-z0-9+#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Dedupe key. The current board dedupes on raw `company::title`, which fails in both
 * directions: "Acme Inc"/"Acme" survive as two jobs, while two genuinely different
 * roles with the same title at the same company collapse into one.
 *
 * Keying on canonical company + canonical title + location fixes the first without
 * introducing the second, because a company rarely posts two distinct roles under an
 * identical title in the same place.
 */
export function dedupeKey(job: Pick<JobPosting, "company" | "title" | "location">): string {
  const location = (job.location ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return `${canonicalCompany(job.company)}::${canonicalTitle(job.title)}::${location}`;
}

/**
 * Collapse postings that describe the same job. Order is significant: the FIRST
 * occurrence wins, so callers should pass their most-trusted source first (a
 * licensed API before a scrape) — the survivor keeps that source's attribution.
 *
 * Where the survivor is missing a field the duplicate has, the duplicate fills it in.
 * A LinkedIn card has no description; the Adzuna copy of the same job does. Merging
 * means the user gets both rather than whichever arrived first.
 */
export function dedupeJobs(jobs: JobPosting[]): JobPosting[] {
  const bySignature = new Map<string, JobPosting>();

  for (const job of jobs) {
    const key = dedupeKey(job);
    const existing = bySignature.get(key);
    if (!existing) {
      bySignature.set(key, { ...job });
      continue;
    }
    bySignature.set(key, mergePostings(existing, job));
  }

  return [...bySignature.values()];
}

/** Copy `field` from source to target only when target lacks it. Key- and value-typed. */
function fillGap<K extends keyof JobPosting>(
  target: JobPosting,
  source: JobPosting,
  field: K,
): void {
  if (target[field] == null && source[field] != null) target[field] = source[field];
}

/** Fill gaps in `primary` from `secondary`. Never overwrites a value primary has. */
function mergePostings(primary: JobPosting, secondary: JobPosting): JobPosting {
  const merged: JobPosting = { ...primary };
  const fillable = [
    "location", "url", "description", "postedAt", "salaryText",
    "salaryMin", "salaryMax", "salaryCurrency", "salaryInterval", "jobLevel",
  ] as const satisfies readonly (keyof JobPosting)[];

  for (const field of fillable) fillGap(merged, secondary, field);

  if (!merged.remote && secondary.remote) merged.remote = true;
  // Union the tag/skill vocabularies — different boards extract different terms,
  // and more terms means better keyword matching downstream.
  merged.tags = [...new Set([...(merged.tags ?? []), ...(secondary.tags ?? [])])];
  const skills = [...new Set([...(merged.skills ?? []), ...(secondary.skills ?? [])])];
  if (skills.length > 0) merged.skills = skills;

  return merged;
}

/**
 * Final pass over a raw posting: fill in what the source left blank by inference,
 * and derive the annualized figure the filters sort on.
 */
export function normalizePosting(job: JobPosting): JobPosting & { salaryAnnualMin?: number } {
  const interval = job.salaryInterval ?? inferSalaryInterval(job.salaryText) ?? undefined;
  const remote =
    job.remote ??
    inferRemote({ title: job.title, location: job.location, description: job.description });

  const annualMin = annualizeSalary(job.salaryMin, interval);

  return {
    ...job,
    remote,
    salaryInterval: interval,
    ...(annualMin != null ? { salaryAnnualMin: annualMin } : {}),
  };
}
