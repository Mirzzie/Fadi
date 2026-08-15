"use server";

import {
  createApplicationsRepository,
  createCareerProfilesRepository,
  createJobsRepository,
  createProfilesRepository,
  createResumesRepository,
  createSavedJobsRepository,
} from "@careeros/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { applyIntentFilter, parseJobPrompt, type JobSearchIntent } from "@/lib/jobs/ai-search";
import { surfForJobs } from "@/lib/jobs/web-surfer";
import { isSafeFetchUrl } from "@/lib/security/url-guard";
import { invalidateJobSync } from "@/lib/jobs/sync";
import { getRecommendedJobsForUser } from "@/lib/jobs/data";
import type { RecommendedJob } from "@/lib/jobs/types";
import { scoreJobForUser } from "@/lib/jobs/job-matching";
import { evaluateApply, type GuardianVerdict } from "@/lib/guardian/guardian";
import { logger } from "@/lib/observability/logger";

const jobIdSchema = z.string().uuid();

const applicationStatusSchema = z.enum([
  "interested",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
]);

export type JobActionResult = {
  ok: boolean;
  message: string;
  /** Fadi speaking up — present when saving an off-direction role (a nudge, not a block). */
  guardian?: GuardianVerdict;
};

async function getSignedInUser() {
  const user = await getCurrentAuthUser();

  if (!user) {
    return null;
  }

  return user;
}

export async function saveJobAction(jobId: string): Promise<JobActionResult> {
  const parsedJobId = jobIdSchema.safeParse(jobId);

  if (!parsedJobId.success) {
    logger.warn("jobs.save.invalid_job_id");

    return {
      ok: false,
      message: "Invalid job.",
    };
  }

  const user = await getSignedInUser();

  if (!user) {
    logger.warn("jobs.save.unauthenticated");

    return {
      ok: false,
      message: "You need to be signed in to save jobs.",
    };
  }

  try {
    const db = getDatabase();
    const jobsRepository = createJobsRepository(db);
    const careerProfilesRepository = createCareerProfilesRepository(db);
    const resumesRepository = createResumesRepository(db);
    const savedJobsRepository = createSavedJobsRepository(db);

    const [job, careerProfile] = await Promise.all([
      jobsRepository.findByIdForUser(user.id, parsedJobId.data),
      careerProfilesRepository.getActiveForUser(user.id),
    ]);
    // Score against THIS direction's resume (falls back to the shared one).
    const resume = await resumesRepository.getLatestForTrack(user.id, careerProfile?.id ?? null);

    if (!job || job.status !== "active") {
      logger.warn("jobs.save.job_not_found", {
        userId: user.id,
      });

      return {
        ok: false,
        message: "Job not found.",
      };
    }

    const match = scoreJobForUser({ careerProfile, resume, job });

    await savedJobsRepository.saveForUser(user.id, job.id, {
      // Stamp the direction it was saved under. Discovery was already scored
      // against this track; the pipeline must remember which one it was.
      careerProfileId: careerProfile?.id ?? null,
      matchScore: match.matchScore,
      matchSummary: match.matchReason,
      matchedSkills: match.matchedKeywords,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobs");
    logger.info("jobs.save.succeeded", {
      userId: user.id,
      jobId: job.id,
    });

    // Fadi guards the action: saved either way, but speak up if it's off-direction.
    const guardian = evaluateApply({
      onRole: match.onRole,
      fieldRelated: match.fieldRelated,
      overLevel: match.overLevel,
      targetRole: careerProfile?.targetRole ?? null,
      jobTitle: job.title,
    });

    return {
      ok: true,
      message: "Job saved.",
      ...(guardian.level !== "ok" ? { guardian } : {}),
    };
  } catch (error) {
    logger.error("jobs.save.failed", {
      userId: user.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return {
      ok: false,
      message: "Could not save this job right now. Please try again later.",
    };
  }
}

export async function unsaveJobAction(jobId: string): Promise<JobActionResult> {
  const parsedJobId = jobIdSchema.safeParse(jobId);

  if (!parsedJobId.success) {
    logger.warn("jobs.unsave.invalid_job_id");

    return {
      ok: false,
      message: "Invalid job.",
    };
  }

  const user = await getSignedInUser();

  if (!user) {
    logger.warn("jobs.unsave.unauthenticated");

    return {
      ok: false,
      message: "You need to be signed in to update saved jobs.",
    };
  }

  try {
    const savedJobsRepository = createSavedJobsRepository(getDatabase());
    await savedJobsRepository.unsaveForUser(user.id, parsedJobId.data);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobs");
    logger.info("jobs.unsave.succeeded", {
      userId: user.id,
      jobId: parsedJobId.data,
    });

    return {
      ok: true,
      message: "Job removed from saved jobs.",
    };
  } catch (error) {
    logger.error("jobs.unsave.failed", {
      userId: user.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return {
      ok: false,
      message: "Could not update this job right now. Please try again later.",
    };
  }
}

export async function updateApplicationStatusAction(
  jobId: string,
  status: string
): Promise<JobActionResult> {
  const parsedJobId = jobIdSchema.safeParse(jobId);
  const parsedStatus = applicationStatusSchema.safeParse(status);

  if (!parsedJobId.success || !parsedStatus.success) {
    logger.warn("jobs.application_status.invalid_input");

    return {
      ok: false,
      message: "Invalid application update.",
    };
  }

  const user = await getSignedInUser();

  if (!user) {
    logger.warn("jobs.application_status.unauthenticated");

    return {
      ok: false,
      message: "You need to be signed in to update application status.",
    };
  }

  try {
    const db = getDatabase();
    const jobsRepository = createJobsRepository(db);
    const applicationsRepository = createApplicationsRepository(db);
    const job = await jobsRepository.findByIdForUser(user.id, parsedJobId.data);

    if (!job || job.status !== "active") {
      logger.warn("jobs.application_status.job_not_found", {
        userId: user.id,
      });

      return {
        ok: false,
        message: "Job not found.",
      };
    }

    await applicationsRepository.upsertStatusForUser(user.id, {
      jobId: job.id,
      company: job.company,
      title: job.title,
      url: job.url,
      status: parsedStatus.data,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobs");
    logger.info("jobs.application_status.succeeded", {
      userId: user.id,
      jobId: job.id,
      status: parsedStatus.data,
    });

    return {
      ok: true,
      message: "Application status updated.",
    };
  } catch (error) {
    logger.error("jobs.application_status.failed", {
      userId: user.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return {
      ok: false,
      message: "Could not update application status right now. Please try again later.",
    };
  }
}

/**
 * Persist the user's job-search preferences (work modes, types, auto-search, the
 * background-agency scope, and a default search location). PARTIAL + merging — only
 * the provided fields change, so saving a location never wipes the saved filters.
 */
export async function saveJobPreferences(input: {
  modes?: string[];
  types?: string[];
  autoSearch?: boolean;
  agentScope?: "filters" | "broad";
  location?: { country?: string; city?: string; precise?: boolean } | null;
}): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  const repo = createProfilesRepository(getDatabase());
  const existing = (await repo.getByUserId(user.id))?.jobPreferences ?? {};
  await repo.setJobPreferences(user.id, {
    modes: input.modes ?? existing.modes,
    types: input.types ?? existing.types,
    autoSearch: input.autoSearch ?? existing.autoSearch,
    agentScope: input.agentScope ?? existing.agentScope,
    // location: explicit null clears it; undefined keeps the current value.
    location: input.location === null ? undefined : (input.location ?? existing.location),
  });
  revalidatePath("/dashboard/jobs");
  return { ok: true };
}

/**
 * AI-prompt job search — the user describes what they want in plain language and Fadi runs it
 * through the central discoverJobs engine, scoped to their active direction, then filters by
 * the parsed keywords/salary/exclusions. Results in one round-trip.
 */
export async function aiJobSearch(
  prompt: string,
  opts?: { global?: boolean }
): Promise<
  { ok: true; jobs: RecommendedJob[]; intent: JobSearchIntent } | { ok: false; message: string }
> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const intent = await parseJobPrompt(prompt);
  // Global scope = search worldwide, ignoring the prompt's / profile's location. Still scoped
  // to the user's active career direction (Fadi's spine); "global" only broadens geography.
  const jobs = await getRecommendedJobsForUser(user.id, 40, {
    country: opts?.global ? undefined : intent.country,
    city: opts?.global ? undefined : intent.city,
    worldwide: opts?.global || undefined,
    modes: intent.remote ? ["remote"] : undefined,
  });
  return { ok: true, jobs: applyIntentFilter(jobs, intent), intent };
}

/**
 * Turn a plain-language search ("graduate IT support in Dublin, remote") into the location +
 * mode the board understands. The ONE search box calls this, then navigates — so the board's
 * existing fresh live-pull runs for the right place. Role stays the active direction (the spine).
 */
export async function resolveSearch(
  prompt: string
): Promise<{ country: string | null; city: string | null; remote: boolean }> {
  // Authenticate BEFORE the (server-funded) AI parse — an unauthenticated caller must never be
  // able to spend our model budget. Returns an empty resolution rather than throwing.
  const user = await getCurrentAuthUser();
  if (!user) return { country: null, city: null, remote: false };

  const intent = await parseJobPrompt(prompt);
  // An explicit search should FETCH, not read a 30-min cache. Drop the sync window so the
  // navigation that follows re-pulls fresh for what the user just asked for — SCOPED to this
  // user's active direction (not a global bump that nukes every user's window), and AWAITED so
  // the generation increment lands before the client navigates and the new page reads it.
  const activeRole = (await createCareerProfilesRepository(getDatabase()).getActiveForUser(user.id))
    ?.targetRole;
  if (activeRole) await invalidateJobSync(activeRole);

  return {
    country: intent.country ?? null,
    city: intent.city ?? null,
    remote: Boolean(intent.remote),
  };
}

/**
 * Fadi Web Surfer: read a company career page or ATS board (Greenhouse / Lever) server-side —
 * the open long tail no API covers — and save the jobs to the pipeline. When the page is a bot
 * wall (Cloudflare / login), it says so and points the user at the extension instead.
 */
export async function surfCareerPage(
  input: string
): Promise<
  | { ok: true; saved: number; found: number; via: string; company?: string }
  | { ok: false; message: string; blocked?: boolean }
> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const url = input.trim();
  if (!url)
    return { ok: false, message: "Paste a company career page or a Greenhouse / Lever board URL." };

  // SSRF guard: this fetches a URL the user typed, server-side. Block non-http(s), localhost,
  // private ranges, and public hostnames that resolve to internal IPs (cloud metadata etc.) —
  // the same guard liveness checks already use. Fails closed.
  if (!(await isSafeFetchUrl(url))) {
    return {
      ok: false,
      message: "That URL can't be fetched. Enter a public company career page or ATS board URL.",
    };
  }

  const res = await surfForJobs(url);
  if (!res.ok) return { ok: false, message: res.reason, blocked: res.blocked };
  if (res.jobs.length === 0) {
    return {
      ok: false,
      message: "No jobs found on that page. Try the company's Greenhouse or Lever board URL.",
    };
  }

  const db = getDatabase();
  const jobsRepo = createJobsRepository(db);
  const savedRepo = createSavedJobsRepository(db);
  let saved = 0;
  let company: string | undefined;
  for (const j of res.jobs.slice(0, 80)) {
    if (!j.title?.trim()) continue;
    company = company ?? j.company;
    try {
      const externalId = (j.url ?? `${j.company ?? ""}:${j.title}`).slice(0, 250);
      const job = await jobsRepo.upsertSeedJob({
        source: "web-surfer",
        externalId,
        ownerUserId: user.id, // PRIVATE: a page the USER chose to surf, not the systematic crawl
        title: j.title,
        company: j.company ?? company ?? "Unknown",
        location: j.location ?? null,
        description: j.description ?? null,
        url: j.url ?? null,
      });
      await savedRepo.saveForUser(user.id, job.id, {});
      saved += 1;
    } catch {
      /* skip the one that failed */
    }
  }
  revalidatePath("/dashboard/jobs");
  return { ok: true, saved, found: res.jobs.length, via: res.via, company };
}
