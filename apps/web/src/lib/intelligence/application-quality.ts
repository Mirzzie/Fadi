import "server-only";

import { getAIProvider } from "@/lib/ai/registry";
import { logger } from "@/lib/observability/logger";
import { z } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApplicationQualityInput {
  jobTitle: string;
  jobCompany: string;
  jobDescription: string;
  resumeText: string;
  targetRole?: string;
  experienceLevel?: string;
  careerGoals?: string;
}

export interface ApplicationQualityResult {
  score: number; // 0–100
  grade: "critical" | "poor" | "viable" | "strong" | "exceptional";
  sendRecommendation: "do_not_send" | "improve_first" | "ready" | "strong";
  breakdown: {
    keywordMatch: { score: number; matched: string[]; missing: string[] };
    formattingRisk: { score: number; issues: string[] };
    experienceAlignment: { score: number; assessment: string };
    specificity: { score: number; assessment: string };
    roleFit: { score: number; assessment: string };
  };
  topImprovements: Array<{ priority: "critical" | "high" | "medium"; action: string; impact: string }>;
  estimatedRecruiterReadTime: string;
  atsRisk: "high" | "medium" | "low";
  aiGeneratedRisk: "high" | "medium" | "low";
  summary: string;
}

const aqsSchema = z.object({
  score: z.number().int().min(0).max(100),
  grade: z.enum(["critical", "poor", "viable", "strong", "exceptional"]),
  sendRecommendation: z.enum(["do_not_send", "improve_first", "ready", "strong"]),
  breakdown: z.object({
    keywordMatch: z.object({
      score: z.number().int().min(0).max(100),
      matched: z.array(z.string()),
      missing: z.array(z.string()),
    }),
    formattingRisk: z.object({
      score: z.number().int().min(0).max(100),
      issues: z.array(z.string()),
    }),
    experienceAlignment: z.object({
      score: z.number().int().min(0).max(100),
      assessment: z.string(),
    }),
    specificity: z.object({
      score: z.number().int().min(0).max(100),
      assessment: z.string(),
    }),
    roleFit: z.object({
      score: z.number().int().min(0).max(100),
      assessment: z.string(),
    }),
  }),
  topImprovements: z.array(
    z.object({
      priority: z.enum(["critical", "high", "medium"]),
      action: z.string(),
      impact: z.string(),
    }),
  ).max(5),
  estimatedRecruiterReadTime: z.string(),
  atsRisk: z.enum(["high", "medium", "low"]),
  aiGeneratedRisk: z.enum(["high", "medium", "low"]),
  summary: z.string().max(400),
});

// ─── Main function ─────────────────────────────────────────────────────────────

export async function scoreApplication(
  input: ApplicationQualityInput,
  userId?: string,
): Promise<ApplicationQualityResult> {
  const provider = getAIProvider();

  if (!provider.isConfigured) {
    logger.warn("aqs.provider_not_configured", { userId });
    return buildFallbackScore();
  }

  const truncatedJD = input.jobDescription.slice(0, 6000);
  const truncatedResume = input.resumeText.slice(0, 8000);

  try {
    const result = await provider.parseStructured(
      [
        {
          role: "system",
          content: `You are CareerOS's Application Quality Scorer. You evaluate how well a candidate's resume matches a specific job description, scoring from 0 to 100. You are calibrated against real hiring data:

- 11.2 seconds average recruiter scan time
- 70% of resumes rejected for formatting issues
- 40% more likely to be selected when JD keywords are present
- 49% of hiring managers auto-dismiss suspected AI-generated resumes

Be accurate and honest. A score of 70+ means viable; 85+ means strong. Do not inflate scores — a 90/100 should actually be exceptional and competitive.`,
        },
        {
          role: "user",
          content: `Score this application.

**Job**: ${input.jobTitle} at ${input.jobCompany}
**Candidate experience level**: ${input.experienceLevel ?? "not specified"}
**Career goals**: ${input.careerGoals ?? "not specified"}

**Job Description**:
${truncatedJD}

**Candidate Resume**:
${truncatedResume}

Produce an honest, specific assessment. The topImprovements should be concrete, actionable changes — not generic advice like "tailor your resume". Name specific skills, specific sections, specific keyword gaps.`,
        },
      ],
      aqsSchema,
      "application_quality_score",
      { temperature: 0.2, userId },
    );

    logger.info("aqs.scored", {
      userId,
      jobTitle: input.jobTitle,
      score: result.score,
      grade: result.grade,
    });

    return result;
  } catch (error) {
    logger.error("aqs.scoring_failed", {
      userId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return buildFallbackScore();
  }
}

function buildFallbackScore(): ApplicationQualityResult {
  return {
    score: 0,
    grade: "critical",
    sendRecommendation: "do_not_send",
    breakdown: {
      keywordMatch: { score: 0, matched: [], missing: [] },
      formattingRisk: { score: 0, issues: ["AI provider not configured — cannot assess"] },
      experienceAlignment: { score: 0, assessment: "AI provider not configured" },
      specificity: { score: 0, assessment: "AI provider not configured" },
      roleFit: { score: 0, assessment: "AI provider not configured" },
    },
    topImprovements: [
      {
        priority: "critical",
        action: "Configure an AI provider (OPENAI_API_KEY or ANTHROPIC_API_KEY)",
        impact: "Required for application quality scoring to function",
      },
    ],
    estimatedRecruiterReadTime: "unknown",
    atsRisk: "high",
    aiGeneratedRisk: "low",
    summary: "Application quality scoring requires an AI provider. Add your API key in settings.",
  };
}

// ─── Score interpretation helpers ─────────────────────────────────────────────

export function getScoreColor(score: number): string {
  if (score >= 88) return "text-emerald-400";
  if (score >= 75) return "text-green-400";
  if (score >= 58) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

export function getScoreBg(score: number): string {
  if (score >= 88) return "bg-emerald-400/15";
  if (score >= 75) return "bg-green-400/15";
  if (score >= 58) return "bg-amber-400/15";
  if (score >= 40) return "bg-orange-400/15";
  return "bg-red-400/15";
}

export function getSendLabel(recommendation: ApplicationQualityResult["sendRecommendation"]): string {
  switch (recommendation) {
    case "strong": return "Ready to send — strong application";
    case "ready": return "Ready to send";
    case "improve_first": return "Improve before sending";
    case "do_not_send": return "Not ready — significant gaps";
  }
}
