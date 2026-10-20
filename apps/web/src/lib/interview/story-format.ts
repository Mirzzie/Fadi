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
  "tell",
  "me",
  "about",
  "a",
  "an",
  "the",
  "time",
  "when",
  "you",
  "your",
  "give",
  "example",
  "describe",
  "of",
  "to",
  "in",
  "on",
  "that",
  "had",
  "have",
  "with",
  "and",
  "or",
  "for",
  "how",
  "did",
  "do",
  "handle",
  "situation",
  "story",
  "what",
  "was",
  "were",
  "is",
  "are",
  "this",
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
 * so it works with no AI call. A story is returned only when the question has a
 * grounded match: a curated competency hit, or at least two content-keyword hits.
 * Returning null is intentional; recommending an unrelated story is worse than
 * admitting that the bank does not cover the question yet.
 */
export function pickBestStory(stories: StoryView[], question: string): StoryView | null {
  if (stories.length === 0) return null;
  const qWords = new Set(keywords(question));
  if (qWords.size === 0) return null;

  let best: StoryView | null = null;
  let bestScore = 0;
  for (const story of stories) {
    const comp = story.competencies.map(normCompetency);
    const competencyWords = new Set(comp.flatMap(keywords));
    const contentWords = new Set(
      keywords(
        `${story.title} ${story.situation} ${story.task} ${story.action} ${story.result} ${story.reflection}`
      )
    );
    const competencyHits = [...competencyWords].filter((word) => qWords.has(word)).length;
    const contentHits = [...contentWords].filter((word) => qWords.has(word)).length;
    if (competencyHits === 0 && contentHits < 2) continue;

    // Curated competency tags are a stronger signal than wording overlap.
    const score = competencyHits * 3 + contentHits;
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
