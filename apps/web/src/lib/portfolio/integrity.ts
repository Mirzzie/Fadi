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
    .describe("Every real problem found. Empty when the portfolio is consistent."),
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
    // A rate-limit or provider error should degrade, not break the CMS.
    return { findings: [], aiError: error instanceof Error ? error.message : "AI check failed" };
  }
}
