/**
 * Pattern-level guardian — the proactive half. Where the Action Guardian reacts to
 * a single action, this notices DRIFT across many: when the roles you keep saving
 * pull away from your active direction, Fadi names it like a mentor and hands you
 * the choice (refocus, or evolve the goal). Pure + deterministic; the background
 * agency runs it and surfaces the result as a ledgered finding.
 */

export interface OffTrackPatternInput {
  /** Saved roles that aren't on the active direction (off-role or over-level). */
  offTrackCount: number;
  /** Total roles currently saved. */
  savedTotal: number;
  targetRole: string | null;
}

/**
 * A supportive "your saved roles are drifting" nudge — or null when there's no real
 * pattern. Fires only on a genuine signal (≥3 off-track AND a majority of saves), so
 * it never nags over one stray save. Locus-of-control stance: name it, offer agency.
 */
export function offTrackPatternFinding(
  input: OffTrackPatternInput,
): { title: string; detail: string } | null {
  if (input.offTrackCount < 3 || input.offTrackCount < input.savedTotal / 2) return null;

  const role = input.targetRole?.trim() || "your target role";
  return {
    title: `${input.offTrackCount} of your saved roles sit outside your ${role} direction`,
    detail: `You keep being drawn to roles off your current track — and that's worth listening to, not ignoring. Is your direction evolving? I can refocus the search on ${role}, or help you set this new direction up properly as its own track. Your call.`,
  };
}
