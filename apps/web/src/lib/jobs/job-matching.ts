import type { CareerProfile, Job, Resume } from "@careeros/database";

import { seniorityFit } from "@/lib/jobs/seniority";

const keywordStopWords = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "your",
  "you",
  "are",
  "will",
  "role",
  "work",
  "team",
  "build",
  "using",
]);

// Generic, everywhere-words that say nothing about whether two roles match.
// "Engineer" appears in IT Support Engineer AND AI Engineer — matching on it is
// noise. We score on the DISTINCTIVE tokens (support, security, devops, soc…).
const genericRoleWords = new Set([
  "engineer",
  "developer",
  "manager",
  "analyst",
  "specialist",
  "consultant",
  "coordinator",
  "administrator",
  "associate",
  "officer",
  "executive",
  "intern",
  "lead",
  "senior",
  "junior",
  "staff",
  "principal",
  "entry",
  "mid",
  "level",
  "remote",
  "hybrid",
  "fulltime",
  "part",
  "time",
  "experience",
  "experienced",
]);

function normalize(value: string | null | undefined) {
  return value?.toLowerCase() ?? "";
}

function tokenize(value: string | null | undefined) {
  return normalize(value)
    .replace(/[^a-z0-9+#. ]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !keywordStopWords.has(token));
}

/** Tokens that actually distinguish one role/profile from another. */
function distinctiveTokens(value: string | null | undefined) {
  return tokenize(value).filter((token) => !genericRoleWords.has(token));
}

/**
 * Word-boundary term test — so "soc" matches "SOC Analyst" but NOT "asSOCiate
 * Professor", and "center" matches "Operations Center" but not a random
 * substring. Substring `.includes` here was promoting unrelated roles (an
 * "Associate Professor" reading as on-role for a "SOC Analyst"). Tokens can carry
 * +/#/. (c++, c#, node.js), so we escape the term and bound on non-alphanumerics.
 */
function containsTerm(haystack: string, term: string): boolean {
  if (term.length < 2) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
}

/**
 * The set of role-family phrases that signal a relevant title for this user —
 * genuinely DOMAIN-AGNOSTIC, with no field privileged over another:
 *  - distinctive tokens from the role(s) + goal, used as-is;
 *  - the whole normalized role phrase ("financial analyst", "registered nurse"),
 *    so any role matches directly;
 *  - every role in an exploration track's `roleCluster` (the user's own related
 *    titles, in any field);
 *  - `roleSynonyms` — equivalent title phrases Fadi generated for THIS track's
 *    field (e.g. nurse → "staff nurse", "rn"; finance → "fp&a analyst"). This
 *    replaces the old hardcoded IT-only map, so a nurse or accountant gets the
 *    same quality of title-variant matching an IT seeker does. When no synonyms
 *    have been generated yet (e.g. no AI provider), every field falls back to
 *    the token + phrase path equally — still no bias.
 */
function roleFamilyTerms(
  targetRole: string | null,
  roleCluster?: string[] | null,
  roleSynonyms?: string[] | null,
): string[] {
  const roles = [targetRole, ...(roleCluster ?? [])].filter(Boolean) as string[];
  const terms = new Set<string>();

  // Distinctive tokens from the user's role TITLE(s) — any field. careerGoal is
  // deliberately excluded: it's aspiration prose ("move into cybersecurity"), and
  // its tokens leak the DOMAIN into the role-kind decision, making any same-domain
  // job (a Professor *of* cybersecurity) read as on-role. Role kind = titles, not
  // goal text. careerGoal still feeds the soft keyword score below.
  for (const r of roles) distinctiveTokens(r).forEach((t) => terms.add(t));

  // Whole-role phrases — the domain-general path (finance, healthcare, trades…).
  for (const r of roles) {
    const phrase = normalize(r).replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();
    if (phrase.length >= 4) terms.add(phrase);
  }

  // Fadi-generated equivalents for this track's field (domain-agnostic).
  for (const s of roleSynonyms ?? []) {
    const phrase = normalize(s).trim();
    if (phrase.length >= 2) terms.add(phrase);
  }

  return [...terms];
}

// Words too generic ACROSS fields to signal that a job is in the user's FIELD —
// used only for the "related role in your field" fallback (NOT the exact-role
// match). Distinctive field words (security, cyber, nurse, audit…) survive.
const fieldGenericWords = new Set([
  ...genericRoleWords,
  "information",
  "operations",
  "operation",
  "center",
  "centre",
  "systems",
  "system",
  "services",
  "service",
  "management",
  "business",
  "support",
  "general",
  "global",
  "national",
  "digital",
  "online",
  "technology",
  "solutions",
  "group",
  "company",
  "response",
  "project",
  "product",
  "program",
  "programme",
  "corporate",
]);

// Job FUNCTIONS that are a different line of work even inside the same field — a
// SOC seeker doesn't want "Cybersecurity Sales" or "Professor of Security", a
// nurse doesn't want "Nurse Recruiter". Keeps the field fallback honest.
const differentFunctionTerms = [
  "sales",
  "account executive",
  "account manager",
  "business development",
  "recruiter",
  "recruiting",
  "recruitment",
  "talent acquisition",
  "sourcer",
  "professor",
  "lecturer",
  "faculty",
  "dean",
  "teacher",
  "tutor",
  "instructor",
  "marketing",
  "copywriter",
  "content",
  "social media",
  "designer",
  "journalist",
];

/** Distinctive FIELD vocabulary from the user's domain + role(s) + synonyms. */
function fieldTermsFor(
  domain: string | null,
  targetRole: string | null,
  roleCluster: string[] | null,
  roleSynonyms: string[] | null,
): string[] {
  const terms = new Set<string>();
  const add = (v: string | null | undefined) =>
    distinctiveTokens(v).forEach((t) => {
      if (t.length >= 3 && !fieldGenericWords.has(t)) terms.add(t);
    });
  add(domain);
  add(targetRole);
  for (const r of roleCluster ?? []) add(r);
  for (const s of roleSynonyms ?? []) add(s);
  return [...terms];
}

/** A title whose FUNCTION is a different line of work (sales/academia/recruiting…). */
function hasDifferentFunction(jobTitle: string): boolean {
  const title = normalize(jobTitle);
  return differentFunctionTerms.some((w) => containsTerm(title, w));
}

/** Same FIELD, but possibly a different role — used only when nothing is on-role. */
function isFieldRelated(jobTitle: string, fieldTerms: string[]): boolean {
  if (hasDifferentFunction(jobTitle)) return false;
  const title = normalize(jobTitle);
  return fieldTerms.some((t) => containsTerm(title, t));
}

/** Role fit + whether this job is even the right KIND of role for the user. */
function roleScore(
  targetRole: string | null,
  roleCluster: string[] | null,
  roleSynonyms: string[] | null,
  jobTitle: string,
): { score: number; onRole: boolean } {
  const terms = roleFamilyTerms(targetRole, roleCluster, roleSynonyms);
  const title = normalize(jobTitle);
  if (terms.length === 0) return { score: 8, onRole: true }; // no profile signal → don't penalise

  const hits = terms.filter((term) => containsTerm(title, term)).length;
  if (hits === 0) return { score: 0, onRole: false }; // wrong kind of role
  return { score: Math.min(45, 25 + (hits - 1) * 12), onRole: true };
}

function locationScore(locationPreference: string | null, job: Job) {
  const preference = normalize(locationPreference);
  const jobLocation = normalize(job.location);
  const remoteMode = normalize(job.remoteMode);

  if (!preference) {
    return 5;
  }

  if (remoteMode === "remote" && preference.includes("remote")) {
    return 20;
  }

  if (remoteMode === "remote") {
    return 12;
  }

  if (preference && jobLocation.includes(preference)) {
    return 20;
  }

  const preferenceTokens = tokenize(preference);
  const hasLocationOverlap = preferenceTokens.some((token) => jobLocation.includes(token));

  return hasLocationOverlap ? 15 : 2;
}

function experienceScore(experienceLevel: string | null, job: Job) {
  const experience = normalize(experienceLevel).replaceAll("_", " ");
  const seniority = normalize(job.seniority);

  if (!experience || !seniority) {
    return 5;
  }

  if (experience.includes("entry") && seniority.includes("entry")) {
    return 15;
  }

  if (
    (experience.includes("mid") || experience.includes("intermediate")) &&
    seniority.includes("mid")
  ) {
    return 15;
  }

  if (
    (experience.includes("senior") || experience.includes("lead")) &&
    seniority.includes("senior")
  ) {
    return 15;
  }

  return 6;
}

function keywordScore(careerProfile: CareerProfile | null, resume: Resume | null, job: Job) {
  // Distinctive-only on both sides, so generic words ("engineer", "systems")
  // don't manufacture a match between unrelated roles.
  const clusterTokens = (careerProfile?.roleCluster ?? []).flatMap((r) => distinctiveTokens(r));
  const profileKeywords = new Set([
    ...distinctiveTokens(careerProfile?.targetRole),
    ...distinctiveTokens(careerProfile?.careerGoal),
    ...clusterTokens,
    ...distinctiveTokens(resume?.parsedText ?? resume?.rawText),
  ]);
  const jobKeywords = new Set([
    ...distinctiveTokens(job.title),
    ...distinctiveTokens(job.description),
    ...distinctiveTokens(JSON.stringify(job.rawPayload ?? {})),
  ]);

  const matchedKeywords = [...jobKeywords]
    .filter((keyword) => profileKeywords.has(keyword))
    .slice(0, 8);

  return {
    score: Math.min(25, matchedKeywords.length * 4),
    matchedKeywords,
  };
}

export function scoreJobForUser({
  careerProfile,
  resume,
  job,
  locationOverride,
}: {
  careerProfile: CareerProfile | null;
  resume: Resume | null;
  job: Job;
  /** When the user actively searches a location, score against THAT, not just the profile. */
  locationOverride?: string | null;
}) {
  const keywordMatch = keywordScore(careerProfile, resume, job);
  const locationPref = locationOverride ?? careerProfile?.location ?? null;
  const role = roleScore(
    careerProfile?.targetRole ?? null,
    careerProfile?.roleCluster ?? null,
    careerProfile?.roleSynonyms ?? null,
    job.title,
  );

  // Not the exact role, but the SAME field (e.g. a Security Engineer for a SOC
  // Analyst) — a useful fallback when no exact-role postings exist, instead of a
  // blank board. Excludes different functions in the field (sales, academia).
  const fieldRelated =
    !role.onRole &&
    isFieldRelated(
      job.title,
      fieldTermsFor(
        careerProfile?.domain ?? null,
        careerProfile?.targetRole ?? null,
        careerProfile?.roleCluster ?? null,
        careerProfile?.roleSynonyms ?? null,
      ),
    );

  // Low floor: an unrelated role should score low, not inherit a generous base.
  const score =
    5 +
    role.score +
    locationScore(locationPref, job) +
    experienceScore(careerProfile?.experienceLevel ?? null, job) +
    keywordMatch.score;
  // Consider the candidate's career stage: a role needing ~2+ levels more than
  // them (an 8–10-year "Staff" role for an early-career profile) is not a real
  // match — demote it and say so, rather than sending them to apply for it.
  const seniority = seniorityFit(job.title, job.description, careerProfile?.experienceLevel ?? null);

  // On-role can climb high; same-field-different-role sits in a middle band so it
  // never out-ranks a real match; off-role noise is capped hard so location +
  // keyword overlap can't promote a "Materials Engineer" to an IT-support seeker.
  let matchScore = role.onRole
    ? Math.min(98, Math.max(5, score))
    : fieldRelated
      ? Math.min(49, Math.max(18, score))
      : Math.min(28, Math.max(5, score));
  if (seniority.overReach) {
    // Cap an out-of-reach role low so it can't sit at the top of the board.
    matchScore = Math.min(matchScore, 35);
  }

  const reasonParts = [
    role.onRole && careerProfile?.targetRole
      ? `role fit with ${careerProfile.targetRole}`
      : null,
    locationPref ? `location: ${locationPref}` : null,
    keywordMatch.matchedKeywords.length > 0
      ? `keyword overlap: ${keywordMatch.matchedKeywords.slice(0, 4).join(", ")}`
      : null,
  ].filter(Boolean);

  const baseReason = role.onRole
    ? reasonParts.length > 0
      ? `Matched on ${reasonParts.join("; ")}.`
      : "Limited overlap with your profile. Review the job description before applying."
    : fieldRelated
      ? `Related role in your field${careerProfile?.domain ? ` (${careerProfile.domain})` : ""} — not an exact ${careerProfile?.targetRole ?? "role"} match, but in the same field. Review before applying.`
      : reasonParts.length > 0
        ? `Matched on ${reasonParts.join("; ")}.`
        : "Limited overlap with your profile. Review the job description before applying.";
  const matchReason = seniority.note ? `${baseReason} ${seniority.note}` : baseReason;

  return {
    matchScore,
    onRole: role.onRole,
    fieldRelated,
    overLevel: seniority.overReach,
    /** A different line of work (sales/academia/…) — gates the semantic-rescue tier. */
    differentFunction: hasDifferentFunction(job.title),
    matchedKeywords: keywordMatch.matchedKeywords,
    matchReason,
  };
}
