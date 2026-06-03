"use server";

import {
  createApplicationsRepository,
  createCareerProfilesRepository,
  createJobsRepository,
  createResumesRepository,
  createSavedJobsRepository,
} from "@careeros/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { scoreJobForUser } from "@/lib/jobs/job-matching";

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
    return {
      ok: false,
      message: "Invalid job.",
    };
  }

  const user = await getSignedInUser();

  if (!user) {
    return {
      ok: false,
      message: "You need to be signed in to save jobs.",
    };
  }

  const db = getDatabase();
  const jobsRepository = createJobsRepository(db);
  const careerProfilesRepository = createCareerProfilesRepository(db);
  const resumesRepository = createResumesRepository(db);
  const savedJobsRepository = createSavedJobsRepository(db);

  const [job, careerProfile, resume] = await Promise.all([
    jobsRepository.findById(parsedJobId.data),
    careerProfilesRepository.getLatestForUser(user.id),
    resumesRepository.getLatestForUser(user.id),
  ]);

  if (!job || job.status !== "active") {
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

  return {
    ok: true,
    message: "Job saved.",
  };
}

export async function unsaveJobAction(jobId: string): Promise<JobActionResult> {
  const parsedJobId = jobIdSchema.safeParse(jobId);

  if (!parsedJobId.success) {
    return {
      ok: false,
      message: "Invalid job.",
    };
  }

  const user = await getSignedInUser();

  if (!user) {
    return {
      ok: false,
      message: "You need to be signed in to update saved jobs.",
    };
  }

  const savedJobsRepository = createSavedJobsRepository(getDatabase());
  await savedJobsRepository.unsaveForUser(user.id, parsedJobId.data);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/jobs");

  return {
    ok: true,
    message: "Job removed from saved jobs.",
  };
}

export async function updateApplicationStatusAction(
  jobId: string,
  status: string
): Promise<JobActionResult> {
  const parsedJobId = jobIdSchema.safeParse(jobId);
  const parsedStatus = applicationStatusSchema.safeParse(status);

  if (!parsedJobId.success || !parsedStatus.success) {
    return {
      ok: false,
      message: "Invalid application update.",
    };
  }

  const user = await getSignedInUser();

  if (!user) {
    return {
      ok: false,
      message: "You need to be signed in to update application status.",
    };
  }

  const db = getDatabase();
  const jobsRepository = createJobsRepository(db);
  const applicationsRepository = createApplicationsRepository(db);
  const job = await jobsRepository.findById(parsedJobId.data);

  if (!job || job.status !== "active") {
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

  return {
    ok: true,
    message: "Application status updated.",
  };
}
