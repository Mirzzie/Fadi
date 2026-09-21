import { getCountry } from "@/lib/jobs/locations";

import { matchesAnyKeyword } from "./keyword-match";

/**
 * Job filtering — strict location + employment type + work mode + visa. Live
 * sources give sparse/inconsistent metadata, so we INFER from the available
 * fields + the title/description text. Inference is best-effort and honest:
 * "unknown" never silently passes a strict filter it can't confirm, except visa
 * where unknown is allowed through (most postings simply don't state it).
 */

export type WorkMode = "remote" | "hybrid" | "onsite";
export type EmploymentType = "full-time" | "part-time" | "contract" | "freelance";
export type VisaFilter = "any" | "sponsored" | "none";

export type JobFilters = {
  country?: string;
  city?: string;
  /** User explicitly chose "Any country" — broaden the live fetch worldwide. */
  worldwide?: boolean;
  /**
   * What the person actually typed, as role/skill words.
   *
   * The search box parsed these and then dropped them: only location and "remote" survived, so
   * "graduate IT support in Dublin" searched the active direction instead (reproduced 20 Sep).
   * A job must match at least one to pass — narrowing the direction's board, never widening it.
   */
  keywords?: string[];
  modes?: WorkMode[];
  types?: EmploymentType[];
  visa?: VisaFilter;
};

export type FilterableJob = {
  title: string;
  location: string | null;
  remoteMode: string | null;
  employmentType: string | null;
  description: string | null;
};

function haystack(j: FilterableJob): string {
  return `${j.title} ${j.location ?? ""} ${j.remoteMode ?? ""} ${j.employmentType ?? ""} ${j.description ?? ""}`.toLowerCase();
}

export function jobWorkMode(j: FilterableJob): WorkMode {
  const mode = (j.remoteMode ?? "").toLowerCase();
  const text = `${j.title} ${j.location ?? ""} ${mode}`.toLowerCase();
  if (mode.includes("hybrid") || /\bhybrid\b/.test(text)) return "hybrid";
  if (mode.includes("remote") || /\bremote\b|work from home|wfh/.test(text)) return "remote";
  return "onsite";
}

export function jobEmploymentType(j: FilterableJob): EmploymentType | "unknown" {
  const t = haystack(j);
  if (/part[\s-]?time/.test(t)) return "part-time";
  if (/\bfreelanc/.test(t)) return "freelance";
  if (/\bcontract(or)?\b|\bfixed[\s-]?term\b|\btemporary\b/.test(t)) return "contract";
  if (/full[\s-]?time|permanent/.test(t)) return "full-time";
  return "unknown";
}

export function jobVisa(j: FilterableJob): "sponsored" | "none" | "unknown" {
  const t = haystack(j);
  if (/visa sponsor|sponsorship (is )?(available|provided|offered|possible)|will sponsor|sponsor(ed)? visa|relocation (support|package)/.test(t))
    return "sponsored";
  if (/no (visa )?sponsorship|sponsorship is not|not able to sponsor|must (have|hold|possess)[^.]{0,40}(right to work|work author[i]?[sz]ation|valid visa)|no relocation/.test(t))
    return "none";
  return "unknown";
}

/** Strict: does this job sit in the chosen country/city? */
export function jobMatchesLocation(j: FilterableJob, country?: string, city?: string): boolean {
  if (!country && !city) return true;
  const loc = (j.location ?? "").toLowerCase();

  // A CITY search must actually be that city — matching only the country lets a
  // Carlow or Cork role through a "Dublin" search (the bug). The country token is
  // a fallback ONLY when no city is given. (Work mode is filtered separately, so a
  // city search stays geographic — "only Dublin roles, never remote-worldwide".)
  const countryName = getCountry(country)?.name?.toLowerCase();
  if (city) {
    if (loc.includes(city.toLowerCase())) return true;
    // Also accept a COUNTRY-LEVEL posting ("Ireland", "Remote — Ireland") — one that names the
    // country but no other specific city. A "Systems Engineer — Ireland" is relevant to a Dublin
    // search; a "Cork, Ireland" role is not. So we strip the country/county/work-mode words and
    // pass only when nothing city-specific remains.
    if (!countryName || !loc.includes(countryName)) return false;
    const remainder = loc
      .split(countryName)
      .join(" ")
      .replace(/county\s+[a-z]+/g, " ")
      .replace(/\b(remote|hybrid|onsite|on-site|flexible|anywhere)\b/g, " ")
      .replace(/[^a-z]+/g, " ")
      .trim();
    return remainder.length === 0;
  }

  return countryName ? loc.includes(countryName) : true;
}

/** All active filters must pass. */
export function passesFilters(j: FilterableJob, f: JobFilters): boolean {
  const mode = jobWorkMode(j);

  // Work-mode filter first.
  if (f.modes && f.modes.length > 0 && !f.modes.includes(mode)) return false;

  // Location, mode-aware — but a remote role still has to be one this person could
  // actually take. Any job whose text said "remote" used to skip the location filter
  // completely, so a Dublin search led with US-only remote roles and a Berlin advert
  // (reproduced 20 Sep: "IT Systems Administrator @ Epic — Remote" top of a Dublin board,
  // an entry-level seeker in Ireland). Remote now bypasses the city, not the country:
  // the posting must name the searched country, or a region that plainly contains it, or
  // say it is worldwide. A bare "Remote" with no geography is UNKNOWN, not eligible —
  // it shows when remote is explicitly chosen, and is labelled by the caller.
  const remoteAsked = Boolean(f.modes && f.modes.includes("remote"));
  const remoteAccepted = mode === "remote" && (remoteAsked || remoteEligibleWhereSearched(j, f));
  if (!remoteAccepted && !jobMatchesLocation(j, f.country, f.city)) return false;

  if (f.keywords && f.keywords.length > 0) {
    if (!matchesAnyKeyword({ title: j.title, description: j.description }, f.keywords)) return false;
  }

  if (f.types && f.types.length > 0) {
    const type = jobEmploymentType(j);
    // A posting that does not STATE its type is not a mismatch — it is silent. Measured on the
    // owner's board 20 Sep: 1,063 of 1,249 live postings state nothing, so a saved "full-time"
    // preference emptied the board completely (20 Dublin roles → 0) while the page blamed the
    // location. Only a posting that states a DIFFERENT type is excluded; the unstated ones are
    // shown and counted, so the person can see what the filter could not confirm.
    if (type !== "unknown" && !f.types.includes(type)) return false;
  }

  if (f.visa && f.visa !== "any") {
    const visa = jobVisa(j);
    if (f.visa === "sponsored" && visa !== "sponsored") return false;
    if (f.visa === "none" && visa === "sponsored") return false; // exclude ones that require sponsorship
  }

  return true;
}

/** Regions a remote posting can name that plainly include the searched country. */
const REGION_OF: Record<string, RegExp> = {
  ie: /\b(ireland|eu|e\.u\.|european union|eea|emea|europe)\b/,
  gb: /\b(uk|united kingdom|britain|emea|europe)\b/,
  de: /\b(germany|deutschland|dach|eu|european union|eea|emea|europe)\b/,
  fr: /\b(france|eu|european union|eea|emea|europe)\b/,
  es: /\b(spain|españa|eu|european union|eea|emea|europe)\b/,
  nl: /\b(netherlands|benelux|eu|european union|eea|emea|europe)\b/,
  us: /\b(usa|u\.s\.|united states|north america|americas|nam)\b/,
  ca: /\b(canada|north america|americas)\b/,
  in: /\b(india|apac|asia)\b/,
  au: /\b(australia|anz|apac|oceania)\b/,
};

const WORLDWIDE_RE = /\b(worldwide|anywhere|global|any country|fully remote, anywhere)\b/;

/**
 * Can this remote posting be worked from the place the person searched?
 *
 * Reads only what the posting states. "Remote — Ireland", "Remote (EMEA)" and "Worldwide" are
 * eligible for an Irish search; "Remote — US" and a bare "Remote" are not, because neither says
 * a person in Ireland may hold it. Never guesses in the candidate's favour.
 */
export function remoteEligibleWhereSearched(j: FilterableJob, f: JobFilters): boolean {
  if (!f.country && !f.city) return true;
  const text = `${j.location ?? ""} ${j.remoteMode ?? ""}`.toLowerCase();
  if (WORLDWIDE_RE.test(text)) return true;
  const countryName = getCountry(f.country)?.name?.toLowerCase();
  if (countryName && text.includes(countryName)) return true;
  if (f.city && text.includes(f.city.toLowerCase())) return true;
  const region = f.country ? REGION_OF[f.country.toLowerCase()] : undefined;
  return region ? region.test(text) : false;
}
