import {
  createCareerProfilesRepository,
  createCareerReportsRepository,
  createLinkedInProfilesRepository,
  createProfilesRepository,
  createResumesRepository,
} from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import type { DashboardProfileSummary, StoredCareerReport } from "@/lib/career-report/schema";

type CareerReportContext = {
  userId: string;
  profileId: string | null;
  careerProfileId: string;
  resumeId: string | null;
  linkedInProfileId: string | null;
  onboardingCompleted: boolean;
  fullName: string | null;
  email?: string;
  targetRole: string | null;
  domain: string | null;
  locationPreference: string | null;
  experienceLevel: string | null;
  careerGoals: string | null;
  linkedInProfileText: string | null;
  resumeText: string | null;
};

function preview(value: string | null | undefined, maxLength = 220) {
  if (!value) {
    return null;
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function toIsoString(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

export async function getCareerReportContext(userId: string): Promise<CareerReportContext | null> {
  const db = getDatabase();
  const careerProfilesRepository = createCareerProfilesRepository(db);
  const profilesRepository = createProfilesRepository(db);
  const resumesRepository = createResumesRepository(db);
  const linkedInProfilesRepository = createLinkedInProfilesRepository(db);

  const careerProfile = await careerProfilesRepository.getActiveForUser(userId);

  if (!careerProfile) {
    return null;
  }

  const [profile, resume, linkedInProfile] = await Promise.all([
    profilesRepository.getByUserId(userId),
    resumesRepository.getLatestForUser(userId),
    linkedInProfilesRepository.getLatestForUser(userId),
  ]);

  return {
    userId,
    profileId: profile?.id ?? careerProfile.profileId ?? null,
    careerProfileId: careerProfile.id,
    resumeId: resume?.id ?? null,
    linkedInProfileId: linkedInProfile?.id ?? null,
    onboardingCompleted: profile?.onboardingCompleted ?? false,
    fullName: profile?.fullName ?? null,
    email: profile?.email ?? undefined,
    targetRole: careerProfile.targetRole,
    domain: careerProfile.domain ?? null,
    locationPreference: careerProfile.location,
    experienceLevel: careerProfile.experienceLevel,
    careerGoals: careerProfile.careerGoal,
    linkedInProfileText: linkedInProfile?.rawText ?? linkedInProfile?.profileUrl ?? null,
    resumeText: resume?.parsedText ?? resume?.rawText ?? null,
  };
}

export async function getDashboardProfileSummary(
  userId: string
): Promise<DashboardProfileSummary | null> {
  const context = await getCareerReportContext(userId);

  if (!context) {
    return null;
  }

  return {
    onboardingCompleted: context.onboardingCompleted,
    fullName: context.fullName,
    email: context.email,
    targetRole: context.targetRole,
    domain: context.domain,
    locationPreference: context.locationPreference,
    experienceLevel: context.experienceLevel,
    careerGoals: context.careerGoals,
    linkedInProfilePreview: preview(context.linkedInProfileText),
    resumePreview: preview(context.resumeText),
  };
}

export async function getLatestCareerReport(userId: string): Promise<StoredCareerReport | null> {
  const db = getDatabase();
  // Scope to the ACTIVE direction so each track shows its own report (and skill
  // gaps / learning path) — not whichever track's report was generated last.
  const activeTrack = await createCareerProfilesRepository(db).getActiveForUser(userId);
  const careerReportsRepository = createCareerReportsRepository(db);
  const report = await careerReportsRepository.getLatestReadyForUser(userId, activeTrack?.id ?? null);

  if (!report) {
    return null;
  }

  return {
    id: report.id,
    career_summary: report.careerSummary,
    strengths: report.strengths,
    missing_skills: report.missingSkills,
    target_role_fit: report.targetRoleFit,
    resume_quality_score: report.resumeQualityScore,
    career_readiness_score: report.careerReadinessScore,
    recommended_actions: report.recommendedActions,
    recommended_learning_path: report.recommendedLearningPath,
    model_name: report.modelName,
    generated_at: toIsoString(report.generatedAt),
    created_at: toIsoString(report.createdAt) ?? new Date().toISOString(),
  };
}
