import type { CareerProfile, Job, Resume } from "@careeros/database";

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
 * The set of role-family phrases that signal a relevant title for this user —
 * genuinely DOMAIN-AGNOSTIC, with no field privileged over another:
 *  - distinctive tokens from the role(s) + goal, used as-is;
 *  - the whole normalized role phrase ("financial analyst", "registered nurse"),
 *    so any role matches directly;
 *  - every role in an exploration track's `roleCluster` (the user's own related
 *    titles, in any field);
 *  - `roleSynonyms` — equivalent title phrases Scout generated for THIS track's
 *    field (e.g. nurse → "staff nurse", "rn"; finance → "fp&a analyst"). This
 *    replaces the old hardcoded IT-only map, so a nurse or accountant gets the
 *    same quality of title-variant matching an IT seeker does. When no synonyms
 *    have been generated yet (e.g. no AI provider), every field falls back to
 *    the token + phrase path equally — still no bias.
 */
function roleFamilyTerms(
  targetRole: string | null,
  careerGoal: string | null,
  roleCluster?: string[] | null,
  roleSynonyms?: string[] | null,
): string[] {
  const roles = [targetRole, ...(roleCluster ?? [])].filter(Boolean) as string[];
  const terms = new Set<string>();

  // Distinctive tokens from the user's role(s) + goal — any field.
  for (const r of roles) distinctiveTokens(r).forEach((t) => terms.add(t));
  distinctiveTokens(careerGoal).forEach((t) => terms.add(t));

  // Whole-role phrases — the domain-general path (finance, healthcare, trades…).
  for (const r of roles) {
    const phrase = normalize(r).replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();
    if (phrase.length >= 4) terms.add(phrase);
  }

  // Scout-generated equivalents for this track's field (domain-agnostic).
  for (const s of roleSynonyms ?? []) {
    const phrase = normalize(s).trim();
    if (phrase.length >= 2) terms.add(phrase);
  }

  return [...terms];
}

/** Role fit + whether this job is even the right KIND of role for the user. */
function roleScore(
  targetRole: string | null,
  careerGoal: string | null,
  roleCluster: string[] | null,
  roleSynonyms: string[] | null,
  jobTitle: string,
): { score: number; onRole: boolean } {
  const terms = roleFamilyTerms(targetRole, careerGoal, roleCluster, roleSynonyms);
  const title = normalize(jobTitle);
  if (terms.length === 0) return { score: 8, onRole: true }; // no profile signal → don't penalise

  const hits = terms.filter((term) => title.includes(term)).length;
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
    careerProfile?.careerGoal ?? null,
    careerProfile?.roleCluster ?? null,
    careerProfile?.roleSynonyms ?? null,
    job.title,
  );
  // Low floor: an unrelated role should score low, not inherit a generous base.
  const score =
    5 +
    role.score +
    locationScore(locationPref, job) +
    experienceScore(careerProfile?.experienceLevel ?? null, job) +
    keywordMatch.score;
  // Off-role jobs are capped hard so location + keyword noise can't promote a
  // "Materials Engineer" to an IT-support seeker.
  const matchScore = role.onRole
    ? Math.min(98, Math.max(5, score))
    : Math.min(28, Math.max(5, score));

  const reasonParts = [
    role.onRole && careerProfile?.targetRole
      ? `role fit with ${careerProfile.targetRole}`
      : null,
    locationPref ? `location: ${locationPref}` : null,
    keywordMatch.matchedKeywords.length > 0
      ? `keyword overlap: ${keywordMatch.matchedKeywords.slice(0, 4).join(", ")}`
      : null,
  ].filter(Boolean);

  return {
    matchScore,
    onRole: role.onRole,
    matchedKeywords: keywordMatch.matchedKeywords,
    matchReason:
      reasonParts.length > 0
        ? `Matched on ${reasonParts.join("; ")}.`
        : "Limited overlap with your profile. Review the job description before applying.",
  };
}
