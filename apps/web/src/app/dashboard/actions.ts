"use server";

import OpenAI from "openai";
import { revalidatePath } from "next/cache";
import { zodResponseFormat } from "openai/helpers/zod";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getCareerReportContext } from "@/lib/career-report/data";
import { careerIntelligenceReportSchema } from "@/lib/career-report/schema";
import { serverEnv } from "@/lib/env.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type GenerateCareerReportResult = {
  ok: boolean;
  message: string;
};

const REPORT_PROMPT_VERSION = "career-report-mvp-v1";

function truncate(value: string | null | undefined, maxLength: number) {
  if (!value) {
    return "Not provided.";
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}\n[truncated]` : value;
}

export async function generateCareerReportAction(): Promise<GenerateCareerReportResult> {
  const user = await getCurrentAuthUser();

  if (!user) {
    return {
      ok: false,
      message: "You need to be signed in to generate a report.",
    };
  }

  if (!serverEnv.OPENAI_API_KEY) {
    return {
      ok: false,
      message: "OpenAI is not configured. Add OPENAI_API_KEY to apps/web/.env.local.",
    };
  }

  const context = await getCareerReportContext(user.id);

  if (!context) {
    return {
      ok: false,
      message: "Complete onboarding before generating a Career Intelligence Report.",
    };
  }

  if (!context.resumeText || !context.careerGoals || !context.targetRole) {
    return {
      ok: false,
      message: "Your onboarding data is incomplete. Add resume text, target role, and goals first.",
    };
  }

  const model = serverEnv.OPENAI_MODEL ?? "gpt-4.1-mini";
  const openai = new OpenAI({
    apiKey: serverEnv.OPENAI_API_KEY,
  });

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
      return {
        ok: false,
        message: "The AI response could not be parsed into a report. Please try again.",
      };
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("career_reports").insert({
      user_id: user.id,
      career_profile_id: context.careerProfileId,
      resume_id: context.resumeId,
      linkedin_profile_id: context.linkedInProfileId,
      status: "ready",
      career_summary: report.careerSummary,
      strengths: report.strengths,
      skill_analysis: report.strengths,
      missing_skills: report.missingSkills,
      target_role_fit: report.targetRoleFit,
      career_opportunities: [
        {
          title: context.targetRole ?? "Target role",
          detail: report.targetRoleFit.explanation,
        },
      ],
      market_demand: {
        note: "Real-time market intelligence is not implemented in the MVP.",
      },
      recommended_learning_path: report.learningRecommendations,
      resume_quality_score: report.resumeQualityScore,
      career_readiness_score: report.careerReadinessScore,
      recommended_actions: report.recommendedNextSteps,
      model_name: model,
      prompt_version: REPORT_PROMPT_VERSION,
      generated_at: new Date().toISOString(),
    });

    if (error) {
      return {
        ok: false,
        message: error.message,
      };
    }

    revalidatePath("/dashboard");

    return {
      ok: true,
      message: "Career Intelligence Report generated.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not generate the report.",
    };
  }
}
