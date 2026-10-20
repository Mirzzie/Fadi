import "server-only";

import { z } from "zod";

import { createCareerProfilesRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { logger } from "@/lib/observability/logger";

/**
 * Gap → the smallest real thing that closes it. Suggests 2–3 concrete,
 * buildable projects (or a course/cert when that's genuinely the right move) for
 * a skill gap in the ACTIVE direction — so a gap becomes a to-do, not a verdict.
 *
 * Honesty rails: suggestions must be completable by one person; materials are
 * given as SEARCH QUERIES (models hallucinate URLs, so we never emit links);
 * nothing goes on a resume until the user actually completes it and says, in
 * their own words, what they built.
 */

export interface ProjectSuggestion {
  title: string;
  detail: string;
  kind: "project" | "course" | "certification";
  searchQuery: string;
}

export type SuggestResult =
  | { ok: true; suggestions: ProjectSuggestion[] }
  | { ok: false; message: string };

const suggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        kind: z.string(),
        searchQuery: z.string(),
      }),
    )
    .max(3),
});

/** Pure: normalise a provider's free-text kind. */
export function toSuggestionKind(raw: string | undefined): ProjectSuggestion["kind"] {
  const k = (raw ?? "").toLowerCase();
  if (k.includes("cert")) return "certification";
  if (k.includes("course") || k.includes("tutorial") || k.includes("video")) return "course";
  return "project";
}

export async function suggestProjectsForGap(
  userId: string,
  input: { gapTitle: string; gapDetail?: string },
): Promise<SuggestResult> {
  const generate = await getUserDocGenerate(userId);
  if (!generate) {
    return { ok: false, message: "Connect an AI provider in Settings and I'll suggest projects that close this gap." };
  }

  const track = await createCareerProfilesRepository(getDatabase()).getActiveForUser(userId);
  const role = track?.targetRole ?? "the target role";

  const system = `You turn ONE skill gap into the SMALLEST real work that closes it — for a candidate targeting ${role}${track?.domain ? ` in ${track.domain}` : ""}.
Suggest 2–3 options, strongest first. Each must be:
- CONCRETE and completable by one person in days-to-weeks (a buildable project with a clear deliverable; a specific well-known course or certification only when that's genuinely the better move for this gap)
- RESUME-WORTHY once done: name what the finished thing demonstrates for ${role}
- detail: 2–3 sentences — exactly what to build/do, and why it closes THIS gap for THIS role
- searchQuery: a short search phrase to find materials/tutorials (NEVER a URL — search terms only)
No filler, no "learn the fundamentals" hand-waving. Real deliverables.`;

  const user = `Skill gap: ${input.gapTitle}\n${input.gapDetail ? `Context from the career report: ${input.gapDetail}` : ""}`;

  try {
    const raw = await generate.structured(system, user, suggestionSchema, "gap_project_suggestions");
    const suggestions = raw.suggestions
      .filter((s) => s.title.trim())
      .map((s) => ({
        title: s.title.trim(),
        detail: s.detail.trim(),
        kind: toSuggestionKind(s.kind),
        // Strip anything URL-shaped — search terms only, never hallucinated links.
        searchQuery: s.searchQuery.replace(/https?:\/\/\S+/g, "").trim() || s.title.trim(),
      }));
    if (suggestions.length === 0) {
      return { ok: false, message: "I couldn't shape suggestions for this gap just now — try again." };
    }
    return { ok: true, suggestions };
  } catch (error) {
    logger.warn("learning.suggest_failed", {
      userId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Suggestion generation failed — check your AI provider and try again." };
  }
}
