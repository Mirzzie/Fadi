"use server";

import { createCareerReportsRepository } from "@careeros/database";
import { revalidatePath } from "next/cache";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { composeCareerEvidence } from "@/lib/career/evidence";
import { getCareerReportContext } from "@/lib/career-report/data";
import { careerIntelligenceReportSchema } from "@/lib/career-report/schema";
import { getDatabase } from "@/lib/database/client";
import { getLaborMarketSnapshot } from "@/lib/labor-market/bls";
import { buildProviderChain } from "@/lib/ai/registry";
import { ResilientProvider } from "@/lib/ai/resilient";
import { getUserProviderConfigs } from "@/lib/ai/user-settings";
import { logger } from "@/lib/observability/logger";
import { consumeRateLimit, refundRateLimit } from "@/lib/security/rate-limit";

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

type ProviderErrorDetails = {
  name: string;
  status?: number;
  code?: string;
  type?: string;
  message?: string;
};

function redactSensitiveErrorText(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return value
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-key]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted-token]");
}

function getProviderErrorDetails(error: unknown): ProviderErrorDetails {
  const errorRecord =
    error && typeof error === "object" ? (error as Record<string, unknown>) : {};

  return {
    name: error instanceof Error ? error.name : "UnknownError",
    status: typeof errorRecord.status === "number" ? errorRecord.status : undefined,
    code: typeof errorRecord.code === "string" ? errorRecord.code : undefined,
    type: typeof errorRecord.type === "string" ? errorRecord.type : undefined,
    message: redactSensitiveErrorText(error instanceof Error ? error.message : undefined),
  };
}

function getUserFacingProviderErrorMessage(details: ProviderErrorDetails) {
  if (details.status === 401 || details.code === "invalid_api_key") {
    return "AI provider credentials are invalid. Check the server API key and try again.";
  }

  if (details.code === "insufficient_quota") {
    return "AI provider quota is unavailable right now. Check billing or quota settings, then try again.";
  }

  if (details.status === 429) {
    return "AI provider rate limits are currently blocking report generation. Please wait and try again.";
  }

  if (details.status === 404) {
    return "The configured AI model is unavailable. Check OPENAI_MODEL and try again.";
  }

  return "FadiOS could not generate the report right now. Please try again later.";
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

  // Resolve the SAME per-user provider chain Fadi chat uses, so a key set in
  // Settings → AI provider drives the report too. buildProviderChain falls back
  // to the server default when the user hasn't configured their own; wrapping it
  // in ResilientProvider gives the report primary→fallback resilience for free.
  const providerChain = buildProviderChain(await getUserProviderConfigs(user.id));
  const provider = new ResilientProvider(providerChain);

  if (!provider.isConfigured) {
    logger.error("career_report.generate.provider_not_configured", {
      userId: user.id,
      provider: provider.name,
    });

    return {
      ok: false,
      message: "Career report generation is not available right now. Configure an AI provider.",
    };
  }

  const rateLimitKey = `career-report:${user.id}`;
  const rateLimit = consumeRateLimit({
    key: rateLimitKey,
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

  // Career history can come from LinkedIn (preferred — the full record) OR a
  // resume; require at least one, not the resume specifically.
  const hasHistory = Boolean(context.resumeText || context.linkedInProfileText);
  if (!hasHistory || !context.careerGoals || !context.targetRole) {
    logger.warn("career_report.generate.context_incomplete", {
      userId: user.id,
    });

    return {
      ok: false,
      message: "Your onboarding data is incomplete. Add your career history (LinkedIn or resume), target role, and goals first.",
    };
  }

  const model = provider.model;
  const careerReportsRepository = createCareerReportsRepository(getDatabase());
  // Per-track cooldown: switching direction lets you generate a fresh report for it.
  const latestReport = await careerReportsRepository.getLatestReadyForUser(
    user.id,
    context.careerProfileId,
  );
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

  // Ground the report's market reasoning in real BLS labor data (honest macro
  // context — never to alarm). Keyless + cached; degrades to empty if unavailable.
  const labor = await getLaborMarketSnapshot();

  const userContext = `
User profile:
- Name: ${context.fullName ?? "Not provided"}
- Target role: ${context.targetRole ?? "Not provided"}
- Location preference: ${context.locationPreference ?? "Not provided"}
- Experience level: ${context.experienceLevel ?? "Not provided"}
- Career goals: ${truncate(context.careerGoals, 1600)}
${labor.summary ? `\nCurrent labor market (real BLS data — use for honest context, not alarm):\n${labor.summary}` : ""}

${composeCareerEvidence({ resumeText: context.resumeText, linkedInText: context.linkedInProfileText }).block}
`;

  try {
    logger.info("career_report.generate.started", {
      userId: user.id,
      model,
      rateLimitRemaining: rateLimit.remaining,
    });

    const completion = await provider.parseStructured(
      [
        {
          role: "system",
          content:
            "You are Fadi, FadiOS's career operating intelligence. You are honest, strategic, and evidence-based. Produce specific career guidance grounded in the user's actual profile. Do not invent credentials, job data, salary facts, or market claims. If evidence is limited, say so explicitly.",
        },
        {
          role: "user",
          content: `Generate the user's Career Intelligence Report from this onboarding context.\n\n${userContext}\n\nReport requirements:\n- Be specific to the user's target role and evidence.\n- Keep recommendations practical for the next 7-14 days.\n- Scores must be integers from 0 to 100.\n- Learning recommendations should be skill-gap based, not generic motivation.\n- Mention uncertainty where profile evidence is thin.`,
        },
      ],
      careerIntelligenceReportSchema,
      "career_intelligence_report",
      { temperature: 0.4, userId: user.id },
    );

    const report = completion;

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
      marketDemand: labor.summary
        ? {
            note: labor.summary,
            source: "U.S. Bureau of Labor Statistics",
            asOf: labor.asOf,
            unemploymentRate: labor.unemploymentRate,
            jobOpeningsMillions: labor.jobOpeningsMillions,
            quitsRate: labor.quitsRate,
          }
        : {
            note: "Live labor-market data is temporarily unavailable — check back shortly.",
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
    const providerError = getProviderErrorDetails(error);
    const isProviderConfig =
      providerError.status === 401 ||
      providerError.status === 404 ||
      providerError.code === "invalid_api_key" ||
      providerError.code === "insufficient_quota";

    if (isProviderConfig) {
      refundRateLimit(rateLimitKey);
    }

    logger.error("career_report.generate.failed", {
      userId: user.id,
      model,
      errorName: providerError.name,
      errorStatus: providerError.status,
      errorCode: providerError.code,
      errorMessage: providerError.message,
    });

    return {
      ok: false,
      message: getUserFacingProviderErrorMessage(providerError),
    };
  }
}
