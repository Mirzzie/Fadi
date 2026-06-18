"use server";

import { createInterviewStoriesRepository } from "@careeros/database";
import { revalidatePath } from "next/cache";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";
import {
  generateStoriesFromEvidence,
  toStoryView,
  type StoryView,
} from "@/lib/interview/story-bank";

const PATH = "/dashboard/interview";

export async function generateStoryBank(): Promise<
  | { ok: true; stories: StoryView[] }
  | { ok: false; message: string }
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
    competencies: input.competencies.map((c) => c.toLowerCase().trim()).filter(Boolean).slice(0, 6),
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
