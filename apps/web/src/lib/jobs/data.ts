import {
  createApplicationsRepository,
  createCareerProfilesRepository,
  createJobsRepository,
  createResumesRepository,
  createSavedJobsRepository,
} from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { scoreJobForUser } from "@/lib/jobs/job-matching";
import type { ApplicationStatus, RecommendedJob } from "@/lib/jobs/types";

export async function getRecommendedJobsForUser(
  userId: string,
  limit?: number
): Promise<RecommendedJob[]> {
  const db = getDatabase();
  const jobsRepository = createJobsRepository(db);
  const careerProfilesRepository = createCareerProfilesRepository(db);
  const resumesRepository = createResumesRepository(db);
  const savedJobsRepository = createSavedJobsRepository(db);
  const applicationsRepository = createApplicationsRepository(db);

  const [jobs, careerProfile, resume] = await Promise.all([
    jobsRepository.listActive(),
    careerProfilesRepository.getLatestForUser(userId),
    resumesRepository.getLatestForUser(userId),
  ]);
  const jobIds = jobs.map((job) => job.id);
  const [savedJobs, applications] = await Promise.all([
    savedJobsRepository.listForUserByJobIds(userId, jobIds),
    applicationsRepository.listForUserByJobIds(userId, jobIds),
  ]);
  const savedByJobId = new Map(savedJobs.map((savedJob) => [savedJob.jobId, savedJob]));
  const applicationByJobId = new Map(
    applications.map((application) => [application.jobId, application])
  );

  const recommendedJobs = jobs
    .map((job) => {
      const match = scoreJobForUser({ careerProfile, resume, job });
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
        matchScore: savedJob?.matchScore ?? match.matchScore,
        matchReason: savedJob?.matchSummary ?? match.matchReason,
        matchedKeywords: savedJob?.matchedSkills ?? match.matchedKeywords,
        isSaved: Boolean(savedJob),
        applicationStatus: (application?.status as ApplicationStatus | undefined) ?? null,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  return typeof limit === "number" ? recommendedJobs.slice(0, limit) : recommendedJobs;
}
