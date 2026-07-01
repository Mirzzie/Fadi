import { getCountry } from "@/lib/jobs/locations";

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
  if (city) return loc.includes(city.toLowerCase());

  const countryName = getCountry(country)?.name?.toLowerCase();
  return countryName ? loc.includes(countryName) : true;
}

/** All active filters must pass. */
export function passesFilters(j: FilterableJob, f: JobFilters): boolean {
  const mode = jobWorkMode(j);

  // Work-mode filter first.
  if (f.modes && f.modes.length > 0 && !f.modes.includes(mode)) return false;

  // Location, mode-aware: a REMOTE role you'd accept isn't tied to the searched
  // city — you can do it from there — so it bypasses the strict city match. Onsite
  // /hybrid roles (and remote roles when you did NOT ask for remote) still must sit
  // in the location. Fixes "Remote selected + Dublin typed → 0 jobs".
  const remoteAccepted =
    mode === "remote" && (!f.modes || f.modes.length === 0 || f.modes.includes("remote"));
  if (!remoteAccepted && !jobMatchesLocation(j, f.country, f.city)) return false;

  if (f.types && f.types.length > 0) {
    const type = jobEmploymentType(j);
    // Unknown employment type can't satisfy a strict type filter.
    if (type === "unknown" || !f.types.includes(type)) return false;
  }

  if (f.visa && f.visa !== "any") {
    const visa = jobVisa(j);
    if (f.visa === "sponsored" && visa !== "sponsored") return false;
    if (f.visa === "none" && visa === "sponsored") return false; // exclude ones that require sponsorship
  }

  return true;
}
