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

function roleScore(targetRole: string | null, jobTitle: string) {
  const targetTokens = tokenize(targetRole);
  const title = normalize(jobTitle);

  if (targetTokens.length === 0) {
    return 0;
  }

  const hits = targetTokens.filter((token) => title.includes(token)).length;
  return Math.min(35, hits * 12);
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
  const profileKeywords = new Set([
    ...tokenize(careerProfile?.targetRole),
    ...tokenize(careerProfile?.careerGoal),
    ...tokenize(resume?.parsedText ?? resume?.rawText),
  ]);
  const jobKeywords = new Set([
    ...tokenize(job.title),
    ...tokenize(job.description),
    ...tokenize(JSON.stringify(job.rawPayload ?? {})),
  ]);

  const matchedKeywords = [...jobKeywords]
    .filter((keyword) => profileKeywords.has(keyword))
    .slice(0, 8);

  return {
    score: Math.min(30, matchedKeywords.length * 5),
    matchedKeywords,
  };
}

export function scoreJobForUser({
  careerProfile,
  resume,
  job,
}: {
  careerProfile: CareerProfile | null;
  resume: Resume | null;
  job: Job;
}) {
  const keywordMatch = keywordScore(careerProfile, resume, job);
  const score =
    20 +
    roleScore(careerProfile?.targetRole ?? null, job.title) +
    locationScore(careerProfile?.location ?? null, job) +
    experienceScore(careerProfile?.experienceLevel ?? null, job) +
    keywordMatch.score;
  const matchScore = Math.max(35, Math.min(98, score));

  const reasonParts = [
    careerProfile?.targetRole ? `target role alignment with ${careerProfile.targetRole}` : null,
    careerProfile?.location ? `location preference: ${careerProfile.location}` : null,
    keywordMatch.matchedKeywords.length > 0
      ? `keyword overlap: ${keywordMatch.matchedKeywords.slice(0, 4).join(", ")}`
      : null,
  ].filter(Boolean);

  return {
    matchScore,
    matchedKeywords: keywordMatch.matchedKeywords,
    matchReason:
      reasonParts.length > 0
        ? `Matched on ${reasonParts.join("; ")}.`
        : "Recommended from local MVP jobs while CareerOS builds your profile signal.",
  };
}
