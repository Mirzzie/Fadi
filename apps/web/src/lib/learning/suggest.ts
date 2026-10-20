import "server-only";

import { z } from "zod";

import { createApplicationsRepository, createCareerProfilesRepository } from "@careeros/database";

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

  // PROBLEMS, NOT TECHNOLOGIES. A hiring manager is not impressed that someone deployed a VPC;
  // they are impressed by someone who answered a problem their team actually has. So a project
  // starts from a realistic workplace scenario — taken from the roles this person is pursuing
  // where there are any — and the technology is how it gets solved. A few strong projects beat
  // twenty generic ones, so each suggestion must be worth being one of the three or four.
  const postings = (
    await createApplicationsRepository(getDatabase()).listForUser(userId, {
      scope: "active",
      careerProfileId: track?.id ?? null,
    })
  )
    .map((application) => application.jobDescription?.trim())
    .filter((text): text is string => Boolean(text))
    .slice(0, 3)
    .map((text) => text.slice(0, 700));

  const system = `You turn ONE skill gap into a portfolio project that closes it — for a candidate targeting ${role}${track?.domain ? ` in ${track.domain}` : ""}.
Suggest 2–3 options, strongest first. Each must be:
- Built around a PROBLEM, not a technology: a realistic situation a ${role} is asked to handle (for example "a company's developers keep committing secrets to repositories", not "learn a secrets scanner"). When job postings are given, take the problem from what they ask for.
- CONCRETE and completable by one person in days-to-weeks, with a clear deliverable; a specific well-known course or certification only when that is genuinely the better move for this gap.
- Something to BUILD, then TEST OR BREAK, then FIX — so the finished work shows findings, decisions and trade-offs, not only a working setup.
- detail: first paragraph = the scenario, in one or two sentences ("A <kind of organisation> has <problem>."). Then a blank line, then 2–3 sentences: what to build, how to prove it works, and what it demonstrates for ${role}.
- searchQuery: a short search phrase to find materials (NEVER a URL — search terms only)
Worth being one of only three or four portfolio projects: no filler, no "learn the fundamentals", no tutorial-follow-alongs.`;

  const user = [
    `Skill gap: ${input.gapTitle}`,
    input.gapDetail ? `Context from the career report: ${input.gapDetail}` : "",
    postings.length > 0
      ? `Roles this person is pursuing (excerpts of the postings):\n${postings.map((text, i) => `[${i + 1}] ${text}`).join("\n\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

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
