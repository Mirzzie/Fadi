"use server";

import { createCareerReportsRepository } from "@careeros/database";
import OpenAI from "openai";
import { revalidatePath } from "next/cache";
import { zodResponseFormat } from "openai/helpers/zod";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getCareerReportContext } from "@/lib/career-report/data";
import { careerIntelligenceReportSchema } from "@/lib/career-report/schema";
import { getDatabase } from "@/lib/database/client";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/observability/logger";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export type GenerateCareerReportResult = {
  ok: boolean;
  message: string;
};

const REPORT_PROMPT_VERSION = "career-report-mvp-v1";
const REPORT_GENERATION_LIMIT = 3;
const REPORT_GENERATION_WINDOW_MS = 60 * 60 * 1000;
const REPORT_GENERATION_COOLDOWN_MS = 10 * 60 * 1000;

type GenerateCareerReportInput = {
  aiPrivacyConsentAccepted: boolean;
};

function truncate(value: string | null | undefined, maxLength: number) {
  if (!value) {
    return "Not provided.";
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}\n[truncated]` : value;
}

function minutesUntil(value: Date) {
  return Math.max(1, Math.ceil((value.getTime() - Date.now()) / 60000));
}

function getReportCooldown(latestGeneratedAt: Date | string | null) {
  if (!latestGeneratedAt) {
    return null;
  }

  const generatedAt =
    latestGeneratedAt instanceof Date ? latestGeneratedAt : new Date(latestGeneratedAt);
  const cooldownEndsAt = new Date(generatedAt.getTime() + REPORT_GENERATION_COOLDOWN_MS);

  return cooldownEndsAt.getTime() > Date.now() ? cooldownEndsAt : null;
}

export async function generateCareerReportAction(
  input: GenerateCareerReportInput
): Promise<GenerateCareerReportResult> {
  const user = await getCurrentAuthUser();

  if (!user) {
    logger.warn("career_report.generate.unauthenticated");

    return {
      ok: false,
      message: "You need to be signed in to generate a report.",
    };
  }

  if (!input.aiPrivacyConsentAccepted) {
    logger.warn("career_report.generate.consent_missing", {
      userId: user.id,
    });

    return {
      ok: false,
      message: "Review and accept the AI privacy notice before generating a report.",
    };
  }

  if (!serverEnv.OPENAI_API_KEY) {
    logger.error("career_report.generate.openai_not_configured", {
      userId: user.id,
    });

    return {
      ok: false,
      message: "Career report generation is not available right now.",
    };
  }

  const rateLimit = consumeRateLimit({
    key: `career-report:${user.id}`,
    limit: REPORT_GENERATION_LIMIT,
    windowMs: REPORT_GENERATION_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    logger.warn("career_report.generate.rate_limited", {
      userId: user.id,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });

    return {
      ok: false,
      message: `Please wait ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s) before generating another report.`,
    };
  }

  const context = await getCareerReportContext(user.id);

  if (!context) {
    logger.warn("career_report.generate.context_missing", {
      userId: user.id,
    });

    return {
      ok: false,
      message: "Complete onboarding before generating a Career Intelligence Report.",
    };
  }

  if (!context.resumeText || !context.careerGoals || !context.targetRole) {
    logger.warn("career_report.generate.context_incomplete", {
      userId: user.id,
    });

    return {
      ok: false,
      message: "Your onboarding data is incomplete. Add resume text, target role, and goals first.",
    };
  }

  const model = serverEnv.OPENAI_MODEL ?? "gpt-4.1-mini";
  const openai = new OpenAI({
    apiKey: serverEnv.OPENAI_API_KEY,
  });
  const careerReportsRepository = createCareerReportsRepository(getDatabase());
  const latestReport = await careerReportsRepository.getLatestReadyForUser(user.id);
  const cooldownEndsAt = getReportCooldown(
    latestReport?.generatedAt ?? latestReport?.createdAt ?? null
  );

  if (cooldownEndsAt) {
    logger.warn("career_report.generate.cooldown_active", {
      userId: user.id,
      cooldownMinutesRemaining: minutesUntil(cooldownEndsAt),
    });

    return {
      ok: false,
      message: `A report was generated recently. Please wait ${minutesUntil(cooldownEndsAt)} minute(s) before generating another one.`,
    };
  }

  const userContext = `
User profile:
- Name: ${context.fullName ?? "Not provided"}
- Target role: ${context.targetRole ?? "Not provided"}
- Location preference: ${context.locationPreference ?? "Not provided"}
- Experience level: ${context.experienceLevel ?? "Not provided"}
- Career goals: ${truncate(context.careerGoals, 1600)}

LinkedIn context:
${truncate(context.linkedInProfileText, 5000)}

Resume text:
${truncate(context.resumeText, 9000)}
`;

  try {
    logger.info("career_report.generate.started", {
      userId: user.id,
      model,
      rateLimitRemaining: rateLimit.remaining,
    });

    const completion = await openai.chat.completions.parse({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are CareerOS AI, a calm, honest, strategic career advisor. Produce specific, evidence-based career guidance. Do not invent credentials, job data, salary facts, or market claims. If evidence is limited, say so in the relevant detail fields.",
        },
        {
          role: "user",
          content: `Generate the user's first MVP Career Intelligence Report from this onboarding context.\n\n${userContext}\n\nReport requirements:\n- Be specific to the user's target role and evidence.\n- Keep recommendations practical for the next 7-14 days.\n- Scores must be integers from 0 to 100.\n- Learning recommendations should be skill-gap based, not generic motivation.\n- Mention uncertainty where profile evidence is thin.`,
        },
      ],
      response_format: zodResponseFormat(
        careerIntelligenceReportSchema,
        "career_intelligence_report"
      ),
      temperature: 0.4,
      safety_identifier: user.id,
    });

    const report = completion.choices[0]?.message.parsed;

    if (!report) {
      logger.error("career_report.generate.parse_failed", {
        userId: user.id,
        model,
      });

      return {
        ok: false,
        message: "CareerOS could not generate a complete report. Please try again later.",
      };
    }

    await careerReportsRepository.createForUser(user.id, {
      careerProfileId: context.careerProfileId,
      resumeId: context.resumeId,
      linkedinProfileId: context.linkedInProfileId,
      status: "ready",
      careerSummary: report.careerSummary,
      strengths: report.strengths,
      skillAnalysis: report.strengths,
      missingSkills: report.missingSkills,
      targetRoleFit: report.targetRoleFit,
      careerOpportunities: [
        {
          title: context.targetRole ?? "Target role",
          detail: report.targetRoleFit.explanation,
        },
      ],
      marketDemand: {
        note: "Real-time market intelligence is not implemented in the MVP.",
      },
      recommendedLearningPath: report.learningRecommendations,
      resumeQualityScore: report.resumeQualityScore,
      careerReadinessScore: report.careerReadinessScore,
      recommendedActions: report.recommendedNextSteps,
      modelName: model,
      promptVersion: REPORT_PROMPT_VERSION,
      generatedAt: new Date(),
    });

    revalidatePath("/dashboard");
    logger.info("career_report.generate.completed", {
      userId: user.id,
      model,
    });

    return {
      ok: true,
      message: "Career Intelligence Report generated.",
    };
  } catch (error) {
    logger.error("career_report.generate.failed", {
      userId: user.id,
      model,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return {
      ok: false,
      message: "CareerOS could not generate the report right now. Please try again later.",
    };
  }
}
