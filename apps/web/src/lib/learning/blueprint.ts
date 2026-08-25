import "server-only";

import { z } from "zod";

import { getCareerReportContext } from "@/lib/career-report/data";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { logger } from "@/lib/observability/logger";

/**
 * The Career Blueprint — a DIRECTION-level "how to actually become this" plan, as
 * opposed to the per-skill-gap suggestions. For the active direction it maps the
 * recognized certification ladder, portfolio proof-projects, and the skills in real
 * demand — grounded in the candidate's current background, and honest (real certs
 * only, verify on the official site; never invent their experience).
 */

const blueprintSchema = z.object({
  certifications: z
    .array(
      z.object({
        name: z.string(),
        level: z.string(), // foundational | associate | professional
        why: z.string(),
        effort: z.string(), // e.g. "2–4 weeks study"
      }),
    )
    .max(6),
  projects: z
    .array(
      z.object({
        title: z.string(),
        proves: z.string(),
        deliverable: z.string(),
      }),
    )
    .max(5),
  inDemandSkills: z
    .array(
      z.object({
        skill: z.string(),
        why: z.string(),
      }),
    )
    .max(6),
});

export type CareerBlueprint = z.infer<typeof blueprintSchema>;

export type BlueprintResult =
  | { ok: true; blueprint: CareerBlueprint }
  | { ok: false; message: string };

export async function generateBlueprint(userId: string): Promise<BlueprintResult> {
  const generate = await getUserDocGenerate(userId);
  if (!generate) {
    return {
      ok: false,
      message: "Connect an AI provider in Settings and I'll map your certification + project path.",
    };
  }

  const ctx = await getCareerReportContext(userId);
  if (!ctx?.targetRole) {
    return {
      ok: false,
      message: "Set up this direction first (a target role, and a bit of your background), then I can map it.",
    };
  }

  const role = ctx.targetRole;
  const system = `You map a concrete path to BECOME a "${role}"${ctx.domain ? ` in ${ctx.domain}` : ""}, tailored to THIS candidate's current background. Return three things:

- certifications: the RECOGNIZED, real certifications that matter for this role, ordered the way a person should pursue them (foundational → associate → professional). SKIP any the candidate already holds. Each: name, level, a one-line why, and a rough effort (e.g. "2–4 weeks study"). Only name real, widely-recognized certifications — if you're not sure one exists, do NOT invent it; describe the area to look for instead. Always assume they must verify current requirements and cost on the official site.
- projects: portfolio projects that PROVE this role's core skills — each with what it proves and the concrete, employer-visible deliverable.
- inDemandSkills: the skills/tools genuinely in demand for this role right now.

Ground everything in the candidate's real background below. Never invent their experience, and never fabricate a certification, tool, or trend.`;

  const user = [
    `Target role: ${role}`,
    ctx.domain ? `Field: ${ctx.domain}` : "",
    ctx.experienceLevel ? `Experience level: ${ctx.experienceLevel}` : "",
    ctx.careerGoals ? `Goal: ${ctx.careerGoals}` : "",
    ctx.resumeText
      ? `Current background (certs, skills, experience):\n${ctx.resumeText.slice(0, 3000)}`
      : "(no resume for this direction yet — infer from the role, and keep it honest.)",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const blueprint = await generate.structured(system, user, blueprintSchema, "career_blueprint");
    return { ok: true, blueprint };
  } catch (error) {
    logger.error("learning.blueprint_failed", {
      userId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "I couldn't map the blueprint just now — please try again." };
  }
}
