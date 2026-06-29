/**
 * The Action Guardian — Fadi's mentor layer. It validates the user's actions
 * against their active career direction and speaks up honestly when something is
 * off-track, over-reach, or irreversible. Pure + deterministic (grounded in the
 * same matching signals as the board), so it's fast, free, and testable; the UI
 * surfaces the verdict as Fadi "speaking out".
 *
 * Posture (the user's choice): GENTLE for off-track actions (a nudge, never a
 * block — respect the user's agency), and only CONFIRM for destructive /
 * irreversible actions. Guidance, not gatekeeping.
 */

export type GuardianLevel = "ok" | "nudge" | "confirm";

export interface GuardianVerdict {
  level: GuardianLevel;
  /** Short mentor headline; empty when level is "ok". */
  headline: string;
  /** Honest, specific guidance — what's off and the better move. */
  detail: string;
}

const OK: GuardianVerdict = { level: "ok", headline: "", detail: "" };

/**
 * Should you pour effort into THIS application, given your direction? Uses the
 * board's own match signals so the bar matches what the user already sees.
 */
export function evaluateApply(input: {
  onRole: boolean;
  fieldRelated: boolean;
  overLevel: boolean;
  targetRole: string | null;
  jobTitle: string;
}): GuardianVerdict {
  const role = input.targetRole?.trim() || "your target role";
  const title = input.jobTitle.trim() || "this role";

  if (input.overLevel) {
    return {
      level: "nudge",
      headline: "This looks more senior than your stage",
      detail: `“${title}” asks for well above your current experience. The odd stretch is fine, but a closer-level match lands far more often — want me to surface better-fit ${role} roles?`,
    };
  }
  if (!input.onRole && !input.fieldRelated) {
    return {
      level: "nudge",
      headline: `This is off your ${role} direction`,
      detail: `“${title}” isn't the kind of role you're aiming for. If your direction is shifting, update your track so I can steer with you — otherwise this is time better spent on ${role} roles.`,
    };
  }
  if (!input.onRole && input.fieldRelated) {
    return {
      level: "nudge",
      headline: `Adjacent to ${role}, not your exact target`,
      detail: `“${title}” is in your field but a different role. Worth it if you're widening your search on purpose — just go in clear-eyed that it's a pivot, not your core direction.`,
    };
  }
  return OK;
}

/** Guard the one irreversible action here: wiping all career data. */
export function evaluateDeleteAllData(): GuardianVerdict {
  return {
    level: "confirm",
    headline: "This erases everything we've built",
    detail:
      "Your direction, saved roles, applications, documents, momentum, and my memory of your journey all go — permanently, and you'll be signed out. If you're starting fresh rather than leaving, changing your track or goal keeps the history intact.",
  };
}
