import "server-only";

import { createJobsRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";

/**
 * Turning one line into work.
 *
 * Deterministic on purpose. "Apply to the Deerfoot role" is not a question to think about; it
 * is a request with a known shape, and routing it through a model would make it slower, less
 * predictable and occasionally wrong about which role was meant. The model's turn comes when
 * this finds nothing — a question is still a question.
 *
 * It only offers to start work when it can NAME what it would work on. An intent bar that says
 * "starting…" and then picks the wrong posting is worse than one that asks which.
 */

export type ResolvedIntent =
  | {
      kind: "plan";
      template: string;
      /** What Fadi will do, named back to the person before they commit to it. */
      label: string;
      refs: { type: string; id: string }[];
    }
  | { kind: "none" };

const APPLY = /^(?:apply(?:\s+(?:to|for))?|tailor(?:\s+\w+)?\s+for)\s+(.{2,})$/i;

/** Cheap word overlap — enough to tell "deerfoot" from "intercom" without pretending to rank. */
function overlap(needle: string, haystack: string): number {
  const words = needle
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((word) => word.length > 2 && !STOP.has(word));
  if (words.length === 0) return 0;
  const text = haystack.toLowerCase();
  return words.filter((word) => text.includes(word)).length / words.length;
}

const STOP = new Set([
  "the",
  "this",
  "that",
  "role",
  "job",
  "position",
  "posting",
  "for",
  "with",
  "fadi",
  "please",
  "and",
]);

export async function resolveIntent(userId: string, text: string): Promise<ResolvedIntent> {
  const match = APPLY.exec(text.trim());
  if (!match) return { kind: "none" };

  const target = match[1]!.trim();
  const jobs = await createJobsRepository(getDatabase()).listActiveForUser(userId);

  let best: { id: string; label: string; score: number } | null = null;
  for (const job of jobs) {
    const score = overlap(target, `${job.title} ${job.company} ${job.location ?? ""}`);
    if (score >= 0.5 && (!best || score > best.score)) {
      best = { id: job.id, label: `${job.company} — ${job.title}`, score };
    }
  }
  if (!best) return { kind: "none" };

  return {
    kind: "plan",
    template: "apply-to-role",
    label: `Apply to ${best.label}`,
    refs: [{ type: "job", id: best.id }],
  };
}
