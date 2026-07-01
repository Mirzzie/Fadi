import { z } from "zod";

export const reportListItemSchema = z.object({
  title: z.string(),
  detail: z.string(),
});

export const targetRoleFitSchema = z.object({
  rating: z.enum(["strong", "moderate", "developing", "unclear"]),
  explanation: z.string(),
});

export const careerIntelligenceReportSchema = z.object({
  careerSummary: z.string(),
  // Lower minimums than before ON PURPOSE: the report should be allowed to say fewer,
  // sharper, evidence-anchored things rather than pad to a count with generic filler.
  strengths: z.array(reportListItemSchema).min(2).max(6),
  missingSkills: z.array(reportListItemSchema).min(1).max(6),
  targetRoleFit: targetRoleFitSchema,
  resumeQualityScore: z.number().int().min(0).max(100),
  careerReadinessScore: z.number().int().min(0).max(100),
  recommendedNextSteps: z.array(reportListItemSchema).min(2).max(6),
  learningRecommendations: z.array(reportListItemSchema).min(1).max(5),
});

export type CareerIntelligenceReport = z.infer<typeof careerIntelligenceReportSchema>;

export type StoredCareerReport = {
  id: string;
  career_summary: string | null;
  strengths: Array<{ title: string; detail: string }>;
  missing_skills: Array<{ title: string; detail: string }>;
  target_role_fit: {
    rating?: string;
    explanation?: string;
  };
  resume_quality_score: number | null;
  career_readiness_score: number | null;
  recommended_actions: Array<{ title: string; detail: string }>;
  recommended_learning_path: Array<{ title: string; detail: string }>;
  model_name: string | null;
  generated_at: string | null;
  created_at: string;
};

export type DashboardProfileSummary = {
  /** Surfaced so pages that already load the summary can gate onboarding without a 2nd profiles query. */
  onboardingCompleted: boolean;
  fullName: string | null;
  email?: string;
  targetRole: string | null;
  /** The active track's field/industry — drives domain-aware job-source coverage. */
  domain: string | null;
  locationPreference: string | null;
  experienceLevel: string | null;
  careerGoals: string | null;
  linkedInProfilePreview: string | null;
  resumePreview: string | null;
};
