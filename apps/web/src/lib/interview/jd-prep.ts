import { z } from "zod";

/**
 * JD-tailored interview prep — Fadi reads a specific job description, infers the
 * behavioral questions THIS role will probe, and drafts a STAR answer for each
 * grounded in the candidate's REAL career: their LinkedIn (the source-of-truth
 * history), résumé, and existing story bank. Never invents experience.
 *
 * This is the "Fadi knows my LinkedIn/achievements → prep me for this job" feature.
 * Pure helpers (formatPrepQuestion / summarizeStoriesForPrep) are test-importable;
 * the AI + DB load dynamically.
 */

export type PrepQuestion = {
  question: string;
  competency: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  /** The story-bank story this answer drew from, when it reused one. */
  basedOn?: string;
  /** True when the candidate's real history didn't cover this — prepare honestly, don't fabricate. */
  needsRealExample?: boolean;
};

export type InterviewPrep = { questions: PrepQuestion[] };

const prepSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string(),
        competency: z.string(),
        situation: z.string(),
        task: z.string(),
        action: z.string(),
        result: z.string(),
        basedOn: z.string().nullable(),
        needsRealExample: z.boolean().nullable(),
      }),
    )
    .max(8),
});

const SYSTEM = `You are Fadi, prepping a candidate for a BEHAVIORAL interview for one SPECIFIC job.

From the job description, infer the 4–6 behavioral/competency questions this role is most likely to ask ("tell me about a time…", "describe a situation where…") — driven by the role's real responsibilities and the competencies it leans on.

For each question, write a STAR answer (Situation, Task, Action, Result) using ONLY the candidate's real experience from the evidence provided (their LinkedIn history, résumé, and existing stories). Hard rules:
- NEVER invent achievements, employers, metrics, or outcomes. Use only what's in the evidence.
- Reuse an existing story when it fits (put its title in "basedOn").
- If the candidate's real history genuinely doesn't cover a likely question, STILL include the question, set needsRealExample = true, and in the STAR fields give guidance on what kind of real example to prepare — never a fabricated one.
- Tailor every answer to THIS job's competencies and language. Keep each field tight and concrete.`;

/** Compact list of the candidate's existing stories for the prompt. */
export function summarizeStoriesForPrep(
  stories: Array<{ title: string; competencies: string[]; result: string }>,
): string {
  if (stories.length === 0) return "(no saved stories yet)";
  return stories
    .slice(0, 10)
    .map((s) => `- ${s.title} [${s.competencies.join(", ")}] → ${s.result}`)
    .join("\n");
}

/** Render one prepped question as readable STAR text (for the chat/tool summary). */
export function formatPrepQuestion(q: PrepQuestion): string {
  const lines = [
    `Q: ${q.question}`,
    q.needsRealExample ? "(No real example on file yet — prepare one; don't invent.)" : "",
    `S: ${q.situation}`,
    `T: ${q.task}`,
    `A: ${q.action}`,
    `R: ${q.result}`,
  ].filter(Boolean);
  return lines.join("\n");
}

export type PrepResult =
  | { ok: true; prep: InterviewPrep }
  | { ok: false; reason: "no_jd" | "no_evidence" | "no_provider" | "error"; message: string };

export async function prepareInterviewForJob(
  userId: string,
  input: { jobDescription: string; jobTitle?: string; company?: string },
): Promise<PrepResult> {
  const jd = (input.jobDescription ?? "").trim();
  if (!jd) {
    return { ok: false, reason: "no_jd", message: "Add the job description and I'll prep you with questions tailored to it." };
  }

  const [{ getCareerReportContext }, { composeCareerEvidence }, { getUserDocGenerate }, { listStories }] =
    await Promise.all([
      import("@/lib/career-report/data"),
      import("@/lib/career/evidence"),
      import("@/lib/ai/user-generate"),
      import("@/lib/interview/story-bank"),
    ]);

  const ctx = await getCareerReportContext(userId);
  const evidence = composeCareerEvidence({
    resumeText: ctx?.resumeText,
    linkedInText: ctx?.linkedInProfileText,
  });
  if (evidence.historySource === "none") {
    return {
      ok: false,
      reason: "no_evidence",
      message:
        "I don't know your background yet. Paste your LinkedIn (your achievements, roles and projects) or upload a résumé, and I'll prep you from your real experience.",
    };
  }

  const generate = await getUserDocGenerate(userId);
  if (!generate) {
    return { ok: false, reason: "no_provider", message: "Connect an AI provider in Settings and I'll prep you for this role." };
  }

  const [stories, topEvidence] = await Promise.all([
    listStories(userId),
    import("@/lib/evidence/pool").then((m) => m.topEvidenceForPrompt(userId)),
  ]);
  const user = [
    `JOB — ${input.jobTitle ?? "(title n/a)"}${input.company ? ` at ${input.company}` : ""}:`,
    jd.slice(0, 6000),
    "",
    evidence.block,
    topEvidence ? `\n${topEvidence}` : "",
    "",
    "The candidate's existing story bank (reuse where it fits):",
    summarizeStoriesForPrep(stories),
  ].join("\n");

  try {
    const raw = await generate.structured(SYSTEM, user, prepSchema, "interview_prep");
    const questions: PrepQuestion[] = (raw.questions ?? [])
      .filter((q) => q.question.trim())
      .map((q) => ({
        question: q.question.trim(),
        competency: q.competency.trim(),
        situation: q.situation.trim(),
        task: q.task.trim(),
        action: q.action.trim(),
        result: q.result.trim(),
        basedOn: q.basedOn?.trim() || undefined,
        needsRealExample: q.needsRealExample ?? false,
      }));
    if (questions.length === 0) {
      return { ok: false, reason: "error", message: "I couldn't draft prep just now — please try again." };
    }
    return { ok: true, prep: { questions } };
  } catch {
    return { ok: false, reason: "error", message: "I couldn't draft prep just now — please try again." };
  }
}
