import { z } from "zod";

import {
  buildExtractionContext,
  formatStoryAsAnswer,
  normCompetency,
  pickBestStory,
  toStoryView,
  type StoryView,
} from "./story-format";

/**
 * Interview story bank — a handful of reusable STAR+Reflection stories mined from
 * the candidate's REAL experience that answer most behavioral questions. Concept
 * adapted from career-ops (santifer/career-ops, MIT) — their "Interview Story Bank"
 * that accumulates master stories; here it's grounded in our LinkedIn-source-of-truth
 * evidence and never invents. Pure matching/formatting lives in ./story-format; this
 * module owns the AI extraction + persistence (server-only deps loaded dynamically).
 */

export type { StarStory, StoryView } from "./story-format";
export { toStoryView, pickBestStory, formatStoryAsAnswer } from "./story-format";

const STORY_SCHEMA = z.object({
  stories: z
    .array(
      z.object({
        title: z.string(),
        competencies: z.array(z.string()),
        situation: z.string(),
        task: z.string(),
        action: z.string(),
        result: z.string(),
        reflection: z.string(),
      }),
    )
    .max(8),
});

const EXTRACTION_SYSTEM = `You build an interview "story bank": reusable STAR+Reflection stories from a candidate's REAL career history that they can use to answer behavioral interview questions.

Hard rules:
- Use ONLY the evidence provided. Never invent achievements, metrics, employers, dates, or outcomes. If a number isn't in the evidence, describe the concrete outcome in words instead of making one up.
- Produce 3–6 DISTINCT master stories that together cover common behavioral themes (leadership, conflict, failure/learning, ownership, ambiguity, influence/persuasion, delivery under pressure). Pick the candidate's strongest, most specific real moments.
- Each story has: a short title; competencies (lowercase tags it answers); situation; task; action (what THEY specifically did); result; reflection (what they learned or would do differently).
- Keep each field tight and concrete — a real moment, not a generic summary. If the evidence is too thin for a genuine story, return fewer. Never pad to hit a count.`;

export type ExtractResult =
  | { ok: true; stories: StoryView[] }
  | { ok: false; reason: "no_evidence" | "no_provider" | "empty"; message: string };

/**
 * Extract STAR+R stories from the candidate's real evidence and persist them.
 * Grounded in the LinkedIn-source-of-truth block; never invents. Returns an honest
 * reason when there's no evidence or no AI provider.
 */
export async function generateStoriesFromEvidence(userId: string): Promise<ExtractResult> {
  const [
    { getCareerReportContext },
    { composeCareerEvidence },
    { getUserDocGenerate },
    { createInterviewStoriesRepository },
    { getDatabase },
  ] = await Promise.all([
    import("@/lib/career-report/data"),
    import("@/lib/career/evidence"),
    import("@/lib/ai/user-generate"),
    import("@careeros/database"),
    import("@/lib/database/client"),
  ]);

  const context = await getCareerReportContext(userId);
  const evidence = composeCareerEvidence({
    resumeText: context?.resumeText,
    linkedInText: context?.linkedInProfileText,
  });
  if (evidence.historySource === "none") {
    return {
      ok: false,
      reason: "no_evidence",
      message:
        "I don't have your career history yet. Paste your LinkedIn or upload a resume first, and I'll mine your real experience into interview stories.",
    };
  }

  const generate = await getUserDocGenerate(userId);
  if (!generate) {
    return {
      ok: false,
      reason: "no_provider",
      message: "Connect an AI provider in Settings and I'll draft your story bank from your experience.",
    };
  }

  let parsed: z.infer<typeof STORY_SCHEMA>;
  try {
    parsed = await generate.structured(
      EXTRACTION_SYSTEM,
      buildExtractionContext(evidence.block),
      STORY_SCHEMA,
      "interview_stories",
    );
  } catch {
    return { ok: false, reason: "empty", message: "I couldn't draft stories just now — please try again." };
  }

  const clean = (parsed.stories ?? []).filter((s) => s.title.trim() && s.action.trim());
  if (clean.length === 0) {
    return {
      ok: false,
      reason: "empty",
      message:
        "There wasn't enough concrete detail in your history for a real story yet. Add more specifics to your LinkedIn/resume and try again.",
    };
  }

  const repo = createInterviewStoriesRepository(getDatabase());
  const created = await repo.createMany(
    userId,
    clean.map((s) => ({
      title: s.title.trim(),
      competencies: s.competencies.map(normCompetency).filter(Boolean).slice(0, 6),
      situation: s.situation.trim(),
      task: s.task.trim(),
      action: s.action.trim(),
      result: s.result.trim(),
      reflection: s.reflection.trim(),
      origin: "ai",
    })),
  );
  return { ok: true, stories: created.map(toStoryView) };
}

const ONE_STORY_SCHEMA = z.object({
  title: z.string(),
  competencies: z.array(z.string()),
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
  reflection: z.string(),
});

const ANSWER_TO_STORY_SYSTEM = `You convert ONE interview answer the candidate just gave (in a practice round) into a reusable STAR+Reflection story for their story bank.

Hard rules:
- Use ONLY what the candidate said in their answer. Never invent achievements, metrics, employers, dates, or outcomes. If a detail isn't in their answer, describe what they did in words rather than fabricating specifics.
- Restructure their answer into: a short title; competencies (lowercase tags this story answers); situation; task; action (what THEY specifically did); result; reflection (what they learned or would do differently).
- Keep each field tight and concrete — a real moment, not a generic summary. If the answer is genuinely too thin for a story, extract honestly what's there; never pad.`;

export type StoryFromAnswerResult =
  | { ok: true; story: StoryView }
  | { ok: false; reason: "empty_answer" | "no_provider" | "empty"; message: string };

/**
 * Turn ONE practiced mock-interview answer into a saved STAR+R story. Grounded
 * strictly in the candidate's own words — never invents — so practice compounds
 * into a reusable asset that feeds JD prep, document generation, and future mocks.
 */
export async function storyFromMockAnswer(
  userId: string,
  input: { question: string; answer: string; role?: string | null; competency?: string | null },
): Promise<StoryFromAnswerResult> {
  const answer = input.answer?.trim() ?? "";
  if (!answer) return { ok: false, reason: "empty_answer", message: "There's no answer to save yet." };

  const [{ getUserDocGenerate }, { createInterviewStoriesRepository }, { getDatabase }] =
    await Promise.all([
      import("@/lib/ai/user-generate"),
      import("@careeros/database"),
      import("@/lib/database/client"),
    ]);

  const generate = await getUserDocGenerate(userId);
  if (!generate) {
    return {
      ok: false,
      reason: "no_provider",
      message: "Connect an AI provider in Settings to save practiced answers as stories.",
    };
  }

  const user = [
    input.role ? `Role: ${input.role}` : "",
    input.competency ? `Competency this question targets: ${input.competency}` : "",
    `Question: ${input.question}`,
    `Candidate's answer:\n${answer.slice(0, 4000)}`,
  ]
    .filter(Boolean)
    .join("\n");

  let s: z.infer<typeof ONE_STORY_SCHEMA>;
  try {
    s = await generate.structured(ANSWER_TO_STORY_SYSTEM, user, ONE_STORY_SCHEMA, "interview_story_from_answer");
  } catch {
    return { ok: false, reason: "empty", message: "I couldn't shape that into a story just now — please try again." };
  }
  if (!s.title.trim() || !s.action.trim()) {
    return {
      ok: false,
      reason: "empty",
      message: "That answer didn't have enough to form a story yet. Add more specifics and re-answer.",
    };
  }

  const repo = createInterviewStoriesRepository(getDatabase());
  const row = await repo.create(userId, {
    title: s.title.trim(),
    competencies: s.competencies.map(normCompetency).filter(Boolean).slice(0, 6),
    situation: s.situation.trim(),
    task: s.task.trim(),
    action: s.action.trim(),
    result: s.result.trim(),
    reflection: s.reflection.trim(),
    origin: "practice",
  });
  return { ok: true, story: toStoryView(row) };
}

/** List a user's stories as views. */
export async function listStories(userId: string): Promise<StoryView[]> {
  const { createInterviewStoriesRepository } = await import("@careeros/database");
  const { getDatabase } = await import("@/lib/database/client");
  const rows = await createInterviewStoriesRepository(getDatabase()).listForUser(userId);
  return rows.map(toStoryView);
}

/** Answer a behavioral question with the best-matching real story (no fabrication). */
export async function answerBehavioral(
  userId: string,
  question: string,
): Promise<{ ok: boolean; answer?: string; storyTitle?: string; message?: string }> {
  const stories = await listStories(userId);
  const story = pickBestStory(stories, question);
  if (!story) {
    return {
      ok: false,
      message:
        "Your story bank is empty. Generate it from your experience first, then I can answer behavioral questions with your real stories.",
    };
  }
  return { ok: true, answer: formatStoryAsAnswer(story), storyTitle: story.title };
}
