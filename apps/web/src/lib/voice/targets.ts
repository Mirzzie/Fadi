import "server-only";

import {
  createDocumentsRepository,
  createJobsRepository,
  createLearningCommitmentsRepository,
  createProjectRunsRepository,
} from "@careeros/database";

import { getDatabase } from "@/lib/database/client";

/**
 * Finding the THING somebody named out loud.
 *
 * "Open the Deerfoot job" has to reach one row in this person's own data. Not a screenshot, not
 * a guess at where it sits on the page — the record itself, by name, from the database that
 * already knows it. Fadi owns this application: it does not need to look at its own screen to
 * find out what is on it, and a pixel-hunting agent would be slower, dearer and less accurate
 * than a query.
 *
 * It scores on overlap and refuses below a bar, because the cost of opening the wrong job for
 * someone who cannot see it is an hour spent on a role they never asked about.
 */

export type VoiceTarget = {
  kind: "job" | "document" | "project" | "commitment";
  id: string;
  /** What Fadi will say it is opening, so the person can stop it if it heard wrong. */
  label: string;
  href: string;
  /** Where its workspace is, when it has one. */
  workspaceHref?: string;
};

const STOP = new Set([
  "the",
  "a",
  "my",
  "that",
  "this",
  "job",
  "jobs",
  "role",
  "roles",
  "posting",
  "position",
  "page",
  "workspace",
  "document",
  "cv",
  "resume",
  "project",
  "course",
  "for",
  "at",
  "in",
  "please",
  "fadi",
  "open",
  "show",
  "me",
]);

function score(spoken: string, haystack: string): number {
  const words = spoken
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((word) => word.length > 2 && !STOP.has(word));
  if (words.length === 0) return 0;
  const text = haystack.toLowerCase();
  return words.filter((word) => text.includes(word)).length / words.length;
}

/** Everything the person could mean, ranked. Only the clear winner is ever returned. */
export async function resolveVoiceTarget(
  userId: string,
  spoken: string,
  only?: VoiceTarget["kind"]
): Promise<VoiceTarget | null> {
  const db = getDatabase();
  const candidates: VoiceTarget[] = [];

  if (!only || only === "job") {
    for (const job of await createJobsRepository(db).listActiveForUser(userId)) {
      candidates.push({
        kind: "job",
        id: job.id,
        label: `${job.title} at ${job.company}`,
        href: `/dashboard/applications/${job.id}/workspace`,
        workspaceHref: `/dashboard/applications/${job.id}/workspace`,
      });
    }
  }

  if (!only || only === "document") {
    for (const document of await createDocumentsRepository(db).listForUser(userId)) {
      candidates.push({
        kind: "document",
        id: document.id,
        label: document.title,
        href: `/dashboard/documents/${document.id}`,
      });
    }
  }

  if (!only || only === "project") {
    for (const run of await createProjectRunsRepository(db).listForUser(userId)) {
      candidates.push({
        kind: "project",
        id: run.id,
        label: run.title,
        href: `/dashboard/learning/projects/${run.id}`,
      });
    }
  }

  if (!only || only === "commitment") {
    for (const commitment of await createLearningCommitmentsRepository(db).listForUser(userId)) {
      candidates.push({
        kind: "commitment",
        id: commitment.id,
        label: commitment.title,
        href: "/dashboard/learning",
      });
    }
  }

  return clearWinner(spoken, candidates);
}

/**
 * The one candidate the spoken words clearly name, or null. Shared by everything that acts on a
 * thing said out loud — a job to save, an application to move, a flagship to take on — so they
 * all refuse the same way: below the bar, or when two match equally well, it is a question.
 */
export function clearWinner<T extends { label: string }>(
  spoken: string,
  candidates: T[],
  /** For a change: two exact matches (two "SOC Analyst" roles) is still a question. */
  options: { refuseExactTies?: boolean } = {}
): T | null {
  let best: { target: T; value: number } | null = null;
  let runnerUp = 0;
  for (const target of candidates) {
    const value = score(spoken, target.label);
    if (!best || value > best.value) {
      runnerUp = best?.value ?? 0;
      best = { target, value };
    } else if (value > runnerUp) {
      runnerUp = value;
    }
  }

  // A clear winner, or nothing. Two things that match equally well is a question, not a choice
  // Fadi gets to make on someone's behalf.
  if (!best || best.value < 0.6) return null;
  if (runnerUp >= best.value && (best.value < 1 || options.refuseExactTies)) return null;
  return best.target;
}

/** The nearest few, for asking "did you mean…" — only ones the words partly match. */
export function closest<T extends { label: string }>(spoken: string, candidates: T[], n = 3): T[] {
  return candidates
    .map((target) => ({ target, value: score(spoken, target.label) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, n)
    .map((c) => c.target);
}
