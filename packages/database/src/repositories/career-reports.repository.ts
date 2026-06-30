import { desc, eq, and } from "drizzle-orm";

import type { Database } from "../client";
import { careerReports, type CareerReport } from "../schema/index";

type ReportListItem = {
  title: string;
  detail: string;
};

export type CreateCareerReportInput = {
  careerProfileId?: string | null;
  resumeId?: string | null;
  linkedinProfileId?: string | null;
  status?: string;
  careerSummary?: string | null;
  strengths?: ReportListItem[];
  skillAnalysis?: ReportListItem[];
  missingSkills?: ReportListItem[];
  targetRoleFit?: {
    rating?: string;
    explanation?: string;
  };
  careerOpportunities?: Array<Record<string, unknown>>;
  marketDemand?: Record<string, unknown>;
  recommendedLearningPath?: ReportListItem[];
  resumeQualityScore?: number | null;
  careerReadinessScore?: number | null;
  recommendedActions?: ReportListItem[];
  modelName?: string | null;
  promptVersion?: string | null;
  generatedAt?: Date | null;
};

export function createCareerReportsRepository(db: Database) {
  return {
    /**
     * Latest ready report. Scope it to a career track (direction) when given, so
     * switching directions shows THAT direction's report — not whichever was
     * generated last. Reports are already tagged with careerProfileId on create.
     */
    async getLatestReadyForUser(
      userId: string,
      careerProfileId?: string | null,
    ): Promise<CareerReport | null> {
      const conditions = [eq(careerReports.userId, userId), eq(careerReports.status, "ready")];
      if (careerProfileId) conditions.push(eq(careerReports.careerProfileId, careerProfileId));

      const [report] = await db
        .select()
        .from(careerReports)
        .where(and(...conditions))
        .orderBy(desc(careerReports.createdAt))
        .limit(1);

      return report ?? null;
    },

    async createForUser(userId: string, input: CreateCareerReportInput): Promise<CareerReport> {
      const [report] = await db
        .insert(careerReports)
        .values({
          userId,
          careerProfileId: input.careerProfileId ?? null,
          resumeId: input.resumeId ?? null,
          linkedinProfileId: input.linkedinProfileId ?? null,
          status: input.status ?? "ready",
          careerSummary: input.careerSummary ?? null,
          strengths: input.strengths ?? [],
          skillAnalysis: input.skillAnalysis ?? input.strengths ?? [],
          missingSkills: input.missingSkills ?? [],
          targetRoleFit: input.targetRoleFit ?? {},
          careerOpportunities: input.careerOpportunities ?? [],
          marketDemand: input.marketDemand ?? {},
          recommendedLearningPath: input.recommendedLearningPath ?? [],
          resumeQualityScore: input.resumeQualityScore ?? null,
          careerReadinessScore: input.careerReadinessScore ?? null,
          recommendedActions: input.recommendedActions ?? [],
          modelName: input.modelName ?? null,
          promptVersion: input.promptVersion ?? null,
          generatedAt: input.generatedAt ?? null,
        })
        .returning();

      return report;
    },
  };
}
