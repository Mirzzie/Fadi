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
import { scoreJobForUser } from "@/lib/jobs/job-matching";
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

    const [job, careerProfile, resume] = await Promise.all([
      jobsRepository.findById(parsedJobId.data),
      careerProfilesRepository.getActiveForUser(user.id),
      resumesRepository.getLatestForUser(user.id),
    ]);

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

    return {
      ok: true,
      message: "Job saved.",
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
    const job = await jobsRepository.findById(parsedJobId.data);

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
