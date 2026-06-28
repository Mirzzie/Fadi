import {
  createApplicationsRepository,
  createCareerProfilesRepository,
  createJobsRepository,
  createResumesRepository,
  createSavedJobsRepository,
} from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { ensureFreshLiveJobs } from "@/lib/jobs/sync";
import { scoreJobForUser } from "@/lib/jobs/job-matching";
import { expandRoleSynonyms } from "@/lib/jobs/role-synonyms";
import { passesFilters, type JobFilters } from "@/lib/jobs/filters";
import { getCountry } from "@/lib/jobs/locations";
import { checkPostingLiveness } from "@/lib/jobs/liveness";
import { sweepJobsLiveness } from "@/lib/jobs/liveness-sweep";
import type { ApplicationStatus, RecommendedJob } from "@/lib/jobs/types";

// Below this match score a role is noise for this user — hide it rather than
// pad the list. Saved/applied roles are always kept regardless.
const MIN_RELEVANCE = 30;

export async function getRecommendedJobsForUser(
  userId: string,
  limit?: number,
  filters?: JobFilters,
  /** skipSync: read stored jobs only (don't block render on a live external pull).
   *  Used by the dashboard preview — the full Jobs page does the live refresh. */
  opts: { skipSync?: boolean } = {}
): Promise<RecommendedJob[]> {
  const db = getDatabase();
  const jobsRepository = createJobsRepository(db);
  const careerProfilesRepository = createCareerProfilesRepository(db);
  const resumesRepository = createResumesRepository(db);
  const savedJobsRepository = createSavedJobsRepository(db);
  const applicationsRepository = createApplicationsRepository(db);

  const [careerProfile, resume] = await Promise.all([
    careerProfilesRepository.getActiveForUser(userId),
    resumesRepository.getLatestForUser(userId),
  ]);

  // First time we score this track, have Fadi generate domain-agnostic role
  // synonyms (nurse → "staff nurse", "rn"; finance → "fp&a analyst") and store
  // them, so title-variant matching is as good for any field as it is for tech.
  // Best-effort + one-time (cached on the track); no AI provider → skip and fall
  // back to the token/phrase path (still unbiased).
  if (
    careerProfile?.targetRole &&
    (!careerProfile.roleSynonyms || careerProfile.roleSynonyms.length === 0)
  ) {
    try {
      const generate = await getUserDocGenerate(userId);
      if (generate) {
        const roles = [careerProfile.targetRole, ...(careerProfile.roleCluster ?? [])];
        const synonyms = await expandRoleSynonyms(roles, generate);
        if (synonyms.length > 0) {
          await careerProfilesRepository.setRoleSynonyms(careerProfile.id, synonyms);
          careerProfile.roleSynonyms = synonyms; // use them for this request too
        }
      }
    } catch {
      // best-effort — matching falls back to tokens + whole-role phrases
    }
  }

  // Pull fresh live postings (Remotive, Arbeitnow, …) into the jobs table,
  // personalized to the user's target role, before we read+score. TTL-guarded,
  // best-effort: if every source is down we just score whatever is stored.
  if (careerProfile?.targetRole && !opts.skipSync) {
    // Bound the live pull so the page never blocks more than a few seconds on slow
    // external sources. The sync keeps running and populates for the next load; we
    // render with whatever's stored now.
    const sync = ensureFreshLiveJobs(
      {
        targetRole: careerProfile.targetRole,
        skills: [],
        skillGaps: [],
        region: careerProfile.location,
        domain: careerProfile.domain,
      },
      { country: filters?.country, city: filters?.city },
    );
    await Promise.race([sync, new Promise((resolve) => setTimeout(resolve, 3500))]);
  }

  const jobs = await jobsRepository.listActive();
  const jobIds = jobs.map((job) => job.id);
  const [savedJobs, applications] = await Promise.all([
    savedJobsRepository.listForUserByJobIds(userId, jobIds),
    applicationsRepository.listForUserByJobIds(userId, jobIds),
  ]);
  const savedByJobId = new Map(savedJobs.map((savedJob) => [savedJob.jobId, savedJob]));
  const applicationByJobId = new Map(
    applications.map((application) => [application.jobId, application])
  );

  // When the user actively searched a location, score against THAT location
  // rather than only their profile's home region.
  const locationOverride =
    filters?.city || filters?.country
      ? [filters?.city, getCountry(filters?.country)?.name].filter(Boolean).join(", ")
      : null;

  const recommendedJobs = jobs
    .map((job) => {
      const match = scoreJobForUser({ careerProfile, resume, job, locationOverride });
      const savedJob = savedByJobId.get(job.id);
      const application = applicationByJobId.get(job.id);

      return {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        remoteMode: job.remoteMode,
        employmentType: job.employmentType,
        seniority: job.seniority,
        salaryText: job.salaryText,
        description: job.description,
        url: job.url,
        postedAt: job.postedAt ?? null,
        firstSeenAt: job.createdAt,
        matchScore: savedJob?.matchScore ?? match.matchScore,
        matchReason: savedJob?.matchSummary ?? match.matchReason,
        matchedKeywords: savedJob?.matchedSkills ?? match.matchedKeywords,
        onRole: match.onRole,
        isSaved: Boolean(savedJob),
        applicationStatus: (application?.status as ApplicationStatus | undefined) ?? null,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  // Hard filters first — the user chose a location / type / mode / visa, so these
  // are strict (a Dublin search shows ONLY Dublin roles, never remote-worldwide).
  const hardFiltered = filters
    ? recommendedJobs.filter((j) => passesFilters(j, filters))
    : recommendedJobs;

  // Relevance gating — NEVER pad with off-role jobs. We'd rather show fewer (or
  // an honest empty state) than surface "Risk Assurance Manager" for an
  // IT-support seeker. Saved/applied roles are always kept.
  const tracked = (j: (typeof recommendedJobs)[number]) => j.isSaved || Boolean(j.applicationStatus);
  const overBar = (j: (typeof recommendedJobs)[number]) => j.matchScore >= MIN_RELEVANCE;

  // 1) Strong: on-role AND above the bar.
  const strong = hardFiltered.filter((j) => (j.onRole && overBar(j)) || tracked(j));
  // 2) Fallback: on-role at any score — the right KIND of role, just weaker —
  //    but still never off-role.
  const onRoleAny = hardFiltered.filter((j) => j.onRole || tracked(j));
  let shown = strong.length > 0 ? strong : onRoleAny.slice(0, 10);

  // Drop postings the source has already CLOSED ("no longer accepting
  // applications" / 404). Bounded, DB-cached probe of just the jobs we're about to
  // show — only on the live page (skipSync = the fast dashboard read). Confirmed-
  // closed roles are persisted (status → "closed") so they leave the board for
  // everyone and never come back on a re-sync. Tracked (saved/applied) roles are
  // never hidden — the workspace shows their liveness banner instead.
  if (!opts.skipSync && shown.length > 0) {
    try {
      const byId = new Map(jobs.map((j) => [j.id, j]));
      const closed = await sweepJobsLiveness(
        shown
          .filter((j) => !tracked(j))
          .map((j) => ({ id: j.id, url: j.url, livenessCheckedAt: byId.get(j.id)?.livenessCheckedAt ?? null })),
        {
          check: checkPostingLiveness,
          persist: (id, state) => jobsRepository.setJobLiveness(id, state),
        },
      );
      if (closed.size > 0) shown = shown.filter((j) => !closed.has(j.id));
    } catch {
      // Best-effort — a flaky probe never blocks the board.
    }
  }

  return typeof limit === "number" ? shown.slice(0, limit) : shown;
}
