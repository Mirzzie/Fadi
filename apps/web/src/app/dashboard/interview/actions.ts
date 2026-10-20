"use server";

import {
  createApplicationsRepository,
  createCareerProfilesRepository,
  createInterviewSessionsRepository,
  createInterviewStoriesRepository,
  createJobsRepository,
} from "@careeros/database";
import { revalidatePath } from "next/cache";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";
import { finishInterviewSessionWork, linkInterviewSessionToWork } from "@/lib/work/domain-links";
import { kickOutbox } from "@/lib/outbox";
import { enqueueOutbox } from "@/lib/outbox/topics";
import {
  generateStoriesFromEvidence,
  storyFromMockAnswer,
  toStoryView,
  type StoryView,
} from "@/lib/interview/story-bank";
import {
  generateMockQuestions,
  scoreInterviewAnswer,
  type AnswerScore,
  type MockQuestion,
} from "@/lib/interview/mock";

const PATH = "/dashboard/interview";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STAGES = new Set(["recruiter", "hiring_manager", "technical", "behavioral"]);
const DURATIONS = new Set([10, 20]);

/** Start one durable, job-aware practice session. */
export async function startMockInterview(input: {
  role: string;
  company?: string | null;
  country?: string;
  seniority?: string;
  jobDescription?: string;
  jobId?: string | null;
  applicationId?: string | null;
  stage?: "recruiter" | "hiring_manager" | "technical" | "behavioral";
  durationMinutes?: 10 | 20;
}): Promise<
  | { ok: true; sessionId: string; workItemId: string | null; questions: MockQuestion[] }
  | { ok: false; message: string }
> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const role = input.role.trim();
  if (!role || role.length > 200) return { ok: false, message: "Pick a valid role first." };
  if (input.company && input.company.trim().length > 200) {
    return { ok: false, message: "That company name is too long." };
  }
  if ((input.country?.length ?? 0) > 120 || (input.seniority?.length ?? 0) > 120) {
    return { ok: false, message: "That interview context is too long." };
  }
  if (input.jobDescription && input.jobDescription.length > 50_000) {
    return { ok: false, message: "That job description is too long." };
  }
  if (
    (input.jobId && !UUID.test(input.jobId)) ||
    (input.applicationId && !UUID.test(input.applicationId))
  ) {
    return { ok: false, message: "That interview context is invalid." };
  }
  if (
    (input.stage && !STAGES.has(input.stage)) ||
    (input.durationMinutes && !DURATIONS.has(input.durationMinutes))
  ) {
    return { ok: false, message: "That interview setup is invalid." };
  }

  try {
    const db = getDatabase();
    const application = input.applicationId
      ? await createApplicationsRepository(db).getForUser(user.id, input.applicationId)
      : null;
    if (input.applicationId && !application) {
      return { ok: false, message: "That application is unavailable." };
    }

    const jobId = input.jobId ?? application?.jobId ?? null;
    if (application?.jobId && input.jobId && application.jobId !== input.jobId) {
      return { ok: false, message: "That job does not match the application." };
    }
    const job = jobId ? await createJobsRepository(db).findByIdForUser(user.id, jobId) : null;
    if (jobId && !job) return { ok: false, message: "That job is unavailable." };

    const stage = input.stage ?? "hiring_manager";
    const durationMinutes = input.durationMinutes ?? 10;
    const generated = await generateMockQuestions(user.id, {
      role,
      country: input.country,
      seniority: input.seniority,
      jobDescription: input.jobDescription,
      stage,
      durationMinutes,
    });
    if (!generated.ok) return generated;

    const activeTrack = application?.careerProfileId
      ? null
      : await createCareerProfilesRepository(db).getActiveForUser(user.id);
    const company = input.company?.trim() || application?.company || job?.company || null;

    const linked = await db.transaction(async (tx) => {
      const session = await createInterviewSessionsRepository(tx).createForUser(user.id, {
        applicationId: application?.id ?? null,
        jobId,
        careerProfileId: application?.careerProfileId ?? activeTrack?.id ?? null,
        role,
        company,
        stage,
        durationMinutes,
        questions: generated.questions.map((question) => ({ ...question })),
      });
      const work = await linkInterviewSessionToWork(tx, user.id, {
        sessionId: session.id,
        role,
        company,
        stage,
        jobId,
        applicationId: application?.id ?? null,
        careerProfileId: application?.careerProfileId ?? activeTrack?.id ?? null,
      });
      return { session, work };
    });

    revalidatePath("/dashboard");
    return {
      ok: true,
      sessionId: linked.session.id,
      workItemId: linked.work?.id ?? null,
      questions: generated.questions,
    };
  } catch (error) {
    logger.error("interview.start_session_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Fadi couldn't start that interview. Please try again." };
  }
}

/** Finish the session and its linked work step together. Repeating the same decision is safe. */
export async function finishMockInterviewSession(input: {
  sessionId: string;
  status: "completed" | "abandoned";
}): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user || !UUID.test(input.sessionId)) return { ok: false };

  try {
    const db = getDatabase();
    const finished = await db.transaction(async (tx) => {
      const session = await createInterviewSessionsRepository(tx).finishForUser(
        user.id,
        input.sessionId,
        input.status
      );
      if (!session) return false;
      await finishInterviewSessionWork(tx, user.id, input.sessionId, input.status);
      if (input.status === "completed") {
        await enqueueOutbox(
          tx,
          user.id,
          "interview.completed",
          { sessionId: input.sessionId },
          input.sessionId
        );
      }
      return true;
    });
    if (finished) kickOutbox();
    revalidatePath("/dashboard");
    return { ok: finished };
  } catch (error) {
    logger.error("interview.finish_session_failed", {
      userId: user.id,
      sessionId: input.sessionId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false };
  }
}

/** Review one practice answer from its transcript, grounded in what they said. */
export async function scoreMockAnswer(input: {
  question: string;
  answer: string;
  role?: string;
  /** The session and question this answer belongs to, so its review outlives the page. */
  sessionId?: string | null;
  questionIndex?: number;
}): Promise<{ ok: true; score: AnswerScore } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const result = await scoreInterviewAnswer(user.id, input);
  if (
    result.ok &&
    input.sessionId &&
    UUID.test(input.sessionId) &&
    input.questionIndex !== undefined
  ) {
    await createInterviewSessionsRepository(getDatabase())
      .recordReview(user.id, input.sessionId, input.questionIndex, {
        scores: result.score.scores,
        improvements: result.score.improvements.slice(0, 3),
      })
      .catch(() => false); // the review is still shown; only the later practice task misses it
  }
  return result;
}

/** Save a practiced mock answer into the story bank as a reusable STAR+R story. */
export async function saveMockAnswerAsStory(input: {
  question: string;
  answer: string;
  role?: string;
  competency?: string;
}): Promise<{ ok: true; story: StoryView } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    const res = await storyFromMockAnswer(user.id, input);
    if (!res.ok) return { ok: false, message: res.message };
    revalidatePath(PATH);
    return { ok: true, story: res.story };
  } catch (error) {
    logger.error("interview.save_mock_answer_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Something went wrong saving that answer. Please try again." };
  }
}

export async function generateStoryBank(): Promise<
  { ok: true; stories: StoryView[] } | { ok: false; message: string }
> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    const res = await generateStoriesFromEvidence(user.id);
    if (!res.ok) return { ok: false, message: res.message };
    revalidatePath(PATH);
    return { ok: true, stories: res.stories };
  } catch (error) {
    logger.error("interview.generate_stories_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Something went wrong drafting your stories. Please try again." };
  }
}

export async function saveStory(input: {
  id?: string;
  title: string;
  competencies: string[];
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string;
}): Promise<{ ok: boolean; story?: StoryView; message?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!input.title.trim()) return { ok: false, message: "Give the story a title." };

  const repo = createInterviewStoriesRepository(getDatabase());
  const fields = {
    title: input.title.trim(),
    competencies: input.competencies
      .map((c) => c.toLowerCase().trim())
      .filter(Boolean)
      .slice(0, 6),
    situation: input.situation.trim(),
    task: input.task.trim(),
    action: input.action.trim(),
    result: input.result.trim(),
    reflection: input.reflection.trim(),
  };

  const row = input.id
    ? await repo.update(user.id, input.id, fields)
    : await repo.create(user.id, { ...fields, origin: "manual" });
  if (!row) return { ok: false, message: "I can't find that story." };
  revalidatePath(PATH);
  return { ok: true, story: toStoryView(row) };
}

export async function deleteStory(input: { id: string }): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  await createInterviewStoriesRepository(getDatabase()).delete(user.id, input.id);
  revalidatePath(PATH);
  return { ok: true };
}
