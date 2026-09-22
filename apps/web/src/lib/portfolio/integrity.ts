import "server-only";

import { z } from "zod";

import type { IntegrityFinding, PortfolioItemView } from "@careeros/portfolio";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { logger } from "@/lib/observability/logger";

// The AI half of the portfolio integrity check: contradictions, timeline errors, and
// anomalies a reader would catch. Uses the user's OWN provider (BYOK). Doctrine: it may only
// flag issues the data actually supports — never invent facts — and it never mutates anything.

const schema = z.object({
  findings: z
    .array(
      z.object({
        severity: z.enum(["contradiction", "timeline", "anomaly", "info"]),
        title: z.string().describe("Short label for the problem."),
        detail: z.string().describe("What's wrong, referencing the entries concretely."),
        itemIds: z.array(z.string()).describe("Exact ids of the entries involved."),
        suggestion: z.string().optional().describe("A short, concrete fix."),
      }),
    )
    .describe("Every real problem found. Empty when the portfolio is consistent.")
    // A CLEAN PORTFOLIO IS THE COMMON CASE, and a model asked for "every problem found" answers
    // a clean one with {} as readily as with {"findings": []}. Requiring the key turned that
    // into a validation error whose raw text — [{"expected":"array","code":"invalid_type"…}] —
    // was printed in the CMS under "Fadi found no contradictions". Absent means none.
    .optional()
    .default([]),
});

const SYSTEM = [
  "You audit a professional portfolio for real problems a careful reader would catch:",
  "CONTRADICTIONS (facts that conflict across entries — e.g. a skill claimed as expert in one place and beginner in another, mismatched dates for the same thing);",
  "TIMELINE errors (an end date before its start, a graduation or role dated in the future stated as completed, overlapping full-time commitments that can't both be true);",
  "ANOMALIES (an entry that doesn't fit the person's story, a claim unsupported by anything else, an obviously misplaced section).",
  "Hard rules: flag ONLY issues the given data actually supports. Never invent facts, never guess missing details, never flag mere style or wording. Reference the offending entries by their exact id. Give a short, concrete fix. If nothing is wrong, return an empty list.",
].join(" ");

export type IntegrityAiResult = {
  findings: IntegrityFinding[];
  aiUnavailable?: boolean;
  aiError?: string;
};

/** Run the AI integrity pass over the portfolio. Returns [] gracefully if AI is unavailable. */
export async function checkPortfolioIntegrityAI(
  userId: string,
  items: PortfolioItemView[],
): Promise<IntegrityAiResult> {
  if (items.length === 0) return { findings: [] };

  const gen = await getUserDocGenerate(userId);
  if (!gen) return { findings: [], aiUnavailable: true };

  const payload = items.map((it) => ({
    id: it.id,
    section: it.section,
    title: it.title,
    organization: it.subtitle ?? undefined,
    dates: it.dateRange ?? undefined,
    description: it.description ?? undefined,
    bullets: it.bullets,
  }));

  try {
    const raw = await gen.structured(
      SYSTEM,
      `Portfolio entries (JSON):\n${JSON.stringify(payload).slice(0, 14_000)}`,
      schema,
      "portfolio_integrity",
    );
    const ids = new Set(items.map((i) => i.id));
    const findings: IntegrityFinding[] = (raw.findings ?? [])
      .filter((f) => f.title?.trim() && f.detail?.trim())
      .map((f) => ({
        severity: f.severity,
        title: f.title.trim(),
        detail: f.detail.trim(),
        itemIds: (f.itemIds ?? []).filter((id) => ids.has(id)),
        suggestion: f.suggestion?.trim() || undefined,
      }));
    return { findings };
  } catch (error) {
    logger.warn("portfolio.integrity_ai_failed", {
      userId,
      error: error instanceof Error ? error.name : "unknown",
    });
    // A rate-limit or provider error should degrade, not break the CMS — and whatever it says,
    // the owner reads a sentence, not a validation dump.
    return { findings: [], aiError: readableAiError(error) };
  }
}

/**
 * What to show the owner when the check could not run.
 *
 * Never the raw error: a Zod failure stringifies to its own issue list, and that JSON was
 * rendered in the CMS as if it were a finding. Provider messages about rate limits and keys are
 * worth passing on; anything machine-shaped is replaced with plain English.
 */
export function readableAiError(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) return "Fadi's AI check couldn't run just now. Nothing was changed.";
  if (message.startsWith("[") || message.startsWith("{")) {
    return "Fadi's AI answered in a shape Fadi couldn't read, so nothing was checked. Try again.";
  }
  if (/rate.?limit|quota|429/i.test(message)) {
    return "Your AI provider is rate-limiting right now. Try the check again in a minute.";
  }
  return message.length > 200 ? `${message.slice(0, 200)}…` : message;
}
