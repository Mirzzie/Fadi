/**
 * Pure seniority/experience inference — turns a job title + JD text into a 0–5
 * level and compares it to the candidate's level, so the board stops recommending
 * an 8–10-year "Staff" role to an early-career profile. No IO; unit-tested.
 *
 *   0 intern/graduate/entry · 1 junior · 2 mid · 3 senior · 4 staff/principal/lead
 *   5 head/director/VP/chief
 */

const TITLE_LEVELS: Array<[RegExp, number]> = [
  [/\b(chief|vp|vice president|head of|director|c[te]o)\b/, 5],
  [/\b(principal|staff|architect)\b/, 4],
  [/\b(senior|sr\.?|lead)\b/, 3],
  [/\b(mid|intermediate)\b/, 2],
  [/\b(junior|jr\.?|graduate|entry[- ]?level)\b/, 1],
  [/\b(intern|internship|trainee|apprentice|entry)\b/, 0],
];

/** Map a minimum years-of-experience requirement to a level. */
export function yearsToLevel(years: number): number {
  if (years >= 9) return 5;
  if (years >= 6) return 4;
  if (years >= 4) return 3;
  if (years >= 2) return 2;
  return 1;
}

/**
 * Lowest years-of-experience a JD asks for — only when tied to "experience" so we
 * don't match unrelated numbers ("last 3 years we grew"). Returns null if absent.
 */
export function parseRequiredYears(text: string): number | null {
  const t = text.toLowerCase();
  const m =
    t.match(/(\d{1,2})\s*(?:\+|-|–|to)?\s*(?:\d{1,2})?\s*\+?\s*years?[^.]{0,25}experience/) ??
    t.match(/experience[^.]{0,25}?(\d{1,2})\s*\+?\s*years?/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 0 && n <= 40 ? n : null;
}

/** Required level from the title + JD; null when neither gives a signal. */
export function requiredLevel(title: string, description?: string | null): number | null {
  const t = (title ?? "").toLowerCase();
  let titleLevel: number | null = null;
  for (const [re, lvl] of TITLE_LEVELS) {
    if (re.test(t)) {
      titleLevel = lvl;
      break;
    }
  }
  const years = description ? parseRequiredYears(description) : null;
  const yearsLevel = years != null ? yearsToLevel(years) : null;
  if (titleLevel == null && yearsLevel == null) return null;
  return Math.max(titleLevel ?? 0, yearsLevel ?? 0);
}

/** The candidate's level from their stored experience level; null if unknown. */
export function userLevel(experienceLevel: string | null | undefined): number | null {
  const e = (experienceLevel ?? "").toLowerCase().replaceAll("_", " ");
  if (!e.trim()) return null;
  if (/lead|principal|staff|director|head|executive/.test(e)) return 4;
  if (/senior/.test(e)) return 3;
  if (/mid|intermediate/.test(e)) return 2;
  if (/junior/.test(e)) return 1;
  if (/entry|graduate|intern|student|beginner|no experience|career chang/.test(e)) return 0;
  return null;
}

export interface SeniorityFit {
  required: number | null;
  user: number | null;
  gap: number;
  /** The role needs ≥2 levels more than the candidate — a real reach, not a stretch. */
  overReach: boolean;
  note: string | null;
}

/** Seniority fit against an ALREADY-resolved user level — so a list scan doesn't
 *  re-parse the user's level for every job. */
export function seniorityFitAt(
  title: string,
  description: string | null | undefined,
  user: number | null,
): SeniorityFit {
  const required = requiredLevel(title, description);
  // Can't judge without both signals — never penalise on a guess.
  if (required == null || user == null) {
    return { required, user, gap: 0, overReach: false, note: null };
  }
  const gap = required - user;
  const overReach = gap >= 2;
  const note = overReach
    ? "This role looks more senior than your current profile — check the years/level it asks for before investing time."
    : null;
  return { required, user, gap, overReach, note };
}

export function seniorityFit(
  title: string,
  description: string | null | undefined,
  experienceLevel: string | null | undefined,
): SeniorityFit {
  return seniorityFitAt(title, description, userLevel(experienceLevel));
}
