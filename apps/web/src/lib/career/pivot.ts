/**
 * Pivot framing — makes the AI direction-aware. Every direction shares ONE source
 * of truth (the user's real career history); what changes per direction is the
 * FRAMING: a same-industry field switch (IT support → cybersecurity) should adopt
 * directly relatable experience and name transferable skills, while a bigger leap
 * should reframe honestly around what genuinely carries. Pure — safe everywhere.
 */

export interface PivotContext {
  targetRole: string | null;
  /** The direction's field/industry (e.g. "Cybersecurity"). */
  domain: string | null;
  /** Track intent: e.g. "career_change", "exploring", "main". */
  intent: string | null;
  careerGoal: string | null;
}

/** A prompt block teaching the generator how to treat history for THIS direction. */
export function pivotFraming(ctx: PivotContext): string {
  const role = ctx.targetRole?.trim() || "the target role";
  const domain = ctx.domain?.trim();
  const intent = (ctx.intent ?? "").toLowerCase();
  const isChange = intent.includes("change") || intent.includes("pivot") || intent.includes("switch");
  const isExploring = intent.includes("explor");

  const lines = [
    `DIRECTION AWARENESS — the candidate is pursuing: ${role}${domain ? ` in ${domain}` : ""}${
      isChange ? " (a career change)" : isExploring ? " (exploring this direction)" : ""
    }.`,
    "Their career history below is the single source of truth, shared across all their directions. Your job is to FRAME it for THIS direction:",
    `- If their experience is in the same industry but a different field (e.g. IT support → ${domain || "this field"}), treat it as directly relatable: overlapping tools, environments, and domain knowledge belong in the foreground, described in ${domain || "the target field"}'s vocabulary where genuinely accurate.`,
    "- Name transferable skills explicitly and tie each to REAL evidence (a task, tool, or outcome they actually have) — 'transferable' is a claim that must be shown, not asserted.",
    "- Foreground the experiences most adjacent to this direction; compress what doesn't serve it. Never delete the truth, never inflate a title, never claim hands-on experience they don't have.",
    isChange
      ? `- This is a deliberate change: position them as bringing proven experience INTO ${domain || "the new field"}, not as starting from zero.`
      : "",
  ].filter(Boolean);

  return lines.join("\n");
}
