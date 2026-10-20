/**
 * Pure, client-safe helpers for the interview story bank — kept out of story-bank.ts
 * (which dynamically imports server-only AI/DB code) so the UI and tests can import
 * matching/formatting without dragging the server chain into the browser bundle.
 */

import type { InterviewStory } from "@careeros/database";

export type StarStory = {
  title: string;
  competencies: string[];
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string;
};

export type StoryView = StarStory & { id: string; origin: string };

export function normCompetency(s: string): string {
  return s.toLowerCase().trim();
}

/** Map a stored row to a serializable view. */
export function toStoryView(row: InterviewStory): StoryView {
  return {
    id: row.id,
    origin: row.origin,
    title: row.title,
    competencies: Array.isArray(row.competencies) ? row.competencies : [],
    situation: row.situation,
    task: row.task,
    action: row.action,
    result: row.result,
    reflection: row.reflection,
  };
}

/** Build the grounded extraction context from a candidate's evidence block. */
export function buildExtractionContext(evidenceBlock: string): string {
  return `${evidenceBlock}\n\nFrom the real experience above, extract the candidate's reusable STAR+Reflection interview stories.`;
}

const STOPWORDS = new Set([
  "tell","me","about","a","an","the","time","when","you","your","give","example",
  "describe","of","to","in","on","that","had","have","with","and","or","for","how",
  "did","do","handle","situation","story","what","was","were","is","are","this",
]);

function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Pick the story that best fits a behavioral question, by overlap between the
 * question's keywords and each story's competencies + content. Pure + deterministic
 * so it works with no AI call. Returns null when the bank is empty.
 */
export function pickBestStory(stories: StoryView[], question: string): StoryView | null {
  if (stories.length === 0) return null;
  const qWords = new Set(keywords(question));
  if (qWords.size === 0) return stories[0];

  let best = stories[0];
  let bestScore = -1;
  for (const story of stories) {
    const comp = story.competencies.map(normCompetency);
    const hay = keywords(`${story.title} ${comp.join(" ")} ${story.situation} ${story.result}`);
    let score = 0;
    for (const w of hay) if (qWords.has(w)) score += 1;
    // Competency tag hits count double — they're the curated index.
    for (const c of comp) if (qWords.has(c)) score += 2;
    if (score > bestScore) {
      best = story;
      bestScore = score;
    }
  }
  return best;
}

/** Shape a story into a spoken STAR answer the candidate can deliver. */
export function formatStoryAsAnswer(story: StoryView): string {
  const lines = [
    `"${story.title}"`,
    `Situation: ${story.situation}`,
    `Task: ${story.task}`,
    `Action: ${story.action}`,
    `Result: ${story.result}`,
  ];
  if (story.reflection.trim()) lines.push(`Reflection: ${story.reflection}`);
  return lines.join("\n");
}
