import { z } from "zod";

/**
 * Interview prep brief — "research the company in minutes", the honest way.
 *
 * The point (per the candidate-coaching ethos) is NOT to memorize facts but to
 * understand the business well enough to have a real conversation. So this builds
 * durable understanding + smart questions to ASK + talking points that connect the
 * candidate's REAL evidence to the role.
 *
 * Honesty mandate (hard): it must NOT state specific recent news, announcements, or
 * numbers as fact — the model can't see today's data and must never fabricate it.
 * Every brief ends with a recency caveat telling the user to verify live. Pure
 * helper (formatBrief) is testable; the AI loads dynamically.
 */

export type CompanyBrief = {
  whatTheyDo: string;
  roleFocus: string;
  industryContext: string;
  /** Questions the candidate can ask the interviewer (shows real engagement). */
  smartQuestions: string[];
  /** How the candidate's real evidence connects to this role. */
  talkingPoints: string[];
  /** Honest reminder to verify current developments before the interview. */
  recencyCaveat: string;
};

const briefSchema = z.object({
  whatTheyDo: z.string(),
  roleFocus: z.string(),
  industryContext: z.string(),
  smartQuestions: z.array(z.string()).max(6).default([]),
  talkingPoints: z.array(z.string()).max(6).default([]),
});

const DEFAULT_CAVEAT =
  "I can't see today's news, so don't quote me on recent announcements or numbers — check the company's site, newsroom, and LinkedIn for the latest before you go in.";

const SYSTEM = `You build an HONEST interview-prep brief so a candidate can have a real conversation about the business — not memorize trivia.

Use the job description and general knowledge to produce:
- whatTheyDo: what the company does and who it serves, in plain language.
- roleFocus: what THIS role is really responsible for and what success looks like (from the JD).
- industryContext: the durable dynamics of their industry (general, not dated).
- smartQuestions: 3–5 genuinely good questions the candidate can ASK the interviewer.
- talkingPoints: 3–5 ways the candidate's REAL evidence (provided) connects to this role.

HARD HONESTY RULES:
- NEVER state specific recent news, announcements, funding, leadership changes, or numbers as fact — you can't see current data and must not fabricate it. Keep to durable understanding.
- talkingPoints must use only the candidate's real evidence; never invent achievements.
- Be concrete and useful, not generic.`;

/** Render a brief as readable text (for the chat/tool summary). Pure. */
export function formatBrief(brief: CompanyBrief): string {
  const lines = [
    `What they do: ${brief.whatTheyDo}`,
    `This role: ${brief.roleFocus}`,
    `Industry: ${brief.industryContext}`,
  ];
  if (brief.smartQuestions.length) lines.push(`\nSmart questions to ask:\n${brief.smartQuestions.map((q) => `• ${q}`).join("\n")}`);
  if (brief.talkingPoints.length) lines.push(`\nYour talking points:\n${brief.talkingPoints.map((p) => `• ${p}`).join("\n")}`);
  lines.push(`\n${brief.recencyCaveat}`);
  return lines.join("\n");
}

export type BriefResult =
  | { ok: true; brief: CompanyBrief }
  | { ok: false; reason: "no_company" | "no_provider" | "error"; message: string };

export async function prepareCompanyBrief(
  userId: string,
  input: { company: string; role?: string; jobDescription?: string },
): Promise<BriefResult> {
  const company = (input.company ?? "").trim();
  if (!company) return { ok: false, reason: "no_company", message: "Tell me which company you're interviewing with." };

  const [{ getUserDocGenerate }, { topEvidenceForPrompt }] = await Promise.all([
    import("@/lib/ai/user-generate"),
    import("@/lib/evidence/pool"),
  ]);
  const generate = await getUserDocGenerate(userId);
  if (!generate) return { ok: false, reason: "no_provider", message: "Connect an AI provider in Settings and I'll build your prep brief." };

  const topEvidence = await topEvidenceForPrompt(userId);
  const user = [
    `Company: ${company}`,
    input.role ? `Role: ${input.role}` : "",
    input.jobDescription?.trim() ? `Job description:\n${input.jobDescription.slice(0, 5000)}` : "",
    topEvidence ? `\n${topEvidence}` : "(no structured evidence on file — keep talking points general but honest.)",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await generate.structured(SYSTEM, user, briefSchema, "company_brief");
    return {
      ok: true,
      brief: {
        whatTheyDo: raw.whatTheyDo.trim(),
        roleFocus: raw.roleFocus.trim(),
        industryContext: raw.industryContext.trim(),
        smartQuestions: raw.smartQuestions.map((s) => s.trim()).filter(Boolean),
        talkingPoints: raw.talkingPoints.map((s) => s.trim()).filter(Boolean),
        recencyCaveat: DEFAULT_CAVEAT,
      },
    };
  } catch (err) {
    const { logger } = await import("@/lib/observability/logger");
    logger.warn("interview.company_brief_failed", { userId, error: err instanceof Error ? err.message : "unknown" });
    return { ok: false, reason: "error", message: "Couldn't build the brief just now — please try again." };
  }
}
