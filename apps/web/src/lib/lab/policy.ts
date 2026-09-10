/**
 * THE POLICY ENGINE — deterministic, and that word is the whole point.
 *
 * Every decision here comes from rules and parameters. None of it consults the model, and
 * none of it depends on how confident the model is that it is doing the right thing. A
 * guardrail that can be talked out of its answer is not a guardrail; it is a second
 * conversation with the same attacker.
 *
 * Pure functions, no database, no clock beyond what is passed in — so the rules can be
 * read in one place and tested without standing anything up. The counting happens
 * outside; the judgement happens here.
 */

/** How much of the world an action can damage. */
export type Blast = "container" | "workspace" | "vm" | "host" | "remote";

/**
 * How hard it is to take back.
 *
 *   reversible   — an exact inverse exists and Fadi can propose it.
 *   disruptive   — recoverable, but something stops working in the meantime.
 *   irreversible — data or state does not come back. Say so; never imply an undo.
 */
export type Reversibility = "reversible" | "disruptive" | "irreversible";

/**
 * What the person has to do to approve it.
 *
 * A click for stopping a container and a click for wiping a VM cannot be the same gesture.
 * Typing the name is not friction for its own sake — it is the difference between an
 * action you chose and an action you clicked past.
 */
export type Confirm = "click" | "type-name";

export type Policy = {
  blast: Blast;
  reversibility: Reversibility;
  confirm: Confirm;
  /** How long the approval prompt stays valid. Shorter for what cannot be undone. */
  ttlMinutes: number;
  /** Ceiling on executions of this recipe per hour. */
  perHour: number;
};

/**
 * Derive the policy from what an action IS, rather than listing it per recipe.
 *
 * A recipe declares its blast radius and reversibility — two facts its author cannot avoid
 * thinking about — and the confirmation strength, prompt lifetime and rate ceiling follow.
 * A new recipe therefore cannot accidentally inherit weak handling by forgetting a field:
 * there is no field to forget.
 */
export function policyFor(input: { blast: Blast; reversibility: Reversibility }): Policy {
  const { blast, reversibility } = input;

  // Anything that cannot be undone, or that reaches past a container, is typed out.
  const confirm: Confirm =
    reversibility === "irreversible" || blast === "host" || blast === "vm" || blast === "remote"
      ? "type-name"
      : "click";

  const ttlMinutes = reversibility === "irreversible" ? 3 : reversibility === "disruptive" ? 5 : 10;

  const perHour =
    reversibility === "irreversible" ? 5 : blast === "host" || blast === "remote" ? 10 : 30;

  return { blast, reversibility, confirm, ttlMinutes, perHour };
}

export type QuotaDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Rate ceiling per recipe.
 *
 * Not about load. A hundred legitimate-looking proposals an hour is not a person working;
 * it is something iterating, and the ceiling is what turns that from a surprise discovered
 * afterwards into a refusal at the time.
 */
export function withinQuota(input: {
  policy: Policy;
  executedLastHour: number;
}): QuotaDecision {
  if (input.executedLastHour >= input.policy.perHour) {
    return {
      allowed: false,
      reason:
        "That's " +
        input.executedLastHour +
        " of these in the last hour, which is the ceiling. Nothing ran. If this was you, it will clear as the hour rolls on.",
    };
  }
  return { allowed: true };
}

export type BreakerState =
  | { tripped: false }
  | { tripped: true; denials: number; reason: string };

/** Denials inside this window trip the breaker. */
export const BREAKER_WINDOW_MINUTES = 5;
export const BREAKER_THRESHOLD = 5;

/**
 * THE CIRCUIT BREAKER.
 *
 * A burst of denied attempts is what a compromised model looks like from the outside — it
 * keeps asking for things it was never given, because whatever is steering it does not
 * know what it has. Waiting for a person to notice that pattern in a log is not a control;
 * people are asleep, or at work, or simply not looking at this page.
 *
 * So the system reacts on its own: past the threshold, every live grant is revoked and
 * nothing proceeds until a person re-consents. False positives cost a re-click. The
 * alternative costs a machine.
 *
 * Denials by a PERSON are excluded — declining a prompt is the system working, and
 * counting it here would punish exactly the behaviour it is trying to encourage.
 */
export function breakerState(
  denials: Array<{ actor: string; createdAt: Date }>,
  now: Date = new Date(),
): BreakerState {
  const since = now.getTime() - BREAKER_WINDOW_MINUTES * 60_000;
  const machineDenials = denials.filter(
    (d) => d.actor !== "user" && d.createdAt.getTime() >= since,
  );

  if (machineDenials.length >= BREAKER_THRESHOLD) {
    return {
      tripped: true,
      denials: machineDenials.length,
      reason:
        machineDenials.length +
        " blocked attempts in " +
        BREAKER_WINDOW_MINUTES +
        " minutes, none of them yours. Fadi has closed every permission and stopped asking. Nothing ran.",
    };
  }
  return { tripped: false };
}

/**
 * Path containment for filesystem work.
 *
 * "Anything touching the host filesystem" is safe the moment it is SCOPED: one directory
 * the user nominated, and no way out of it. The check is on the RESOLVED path, because
 * `..` is the obvious escape and a symlink is the one people forget — a link inside the
 * workspace pointing at `/etc` is a legal path by every string test and a total escape by
 * every real one.
 *
 * Callers must pass paths already resolved through `realpath`. This function does the
 * containment; it cannot do the resolution, because resolution touches the disk and this
 * file stays pure.
 */
export function isInsideWorkspace(resolvedPath: string, resolvedRoot: string): boolean {
  if (!resolvedRoot || !resolvedPath) return false;
  // A root is contained in itself; a sibling that merely shares a prefix is not
  // ("/home/me/fadi-labs-old" must not pass for "/home/me/fadi-labs").
  const root = resolvedRoot.endsWith("/") ? resolvedRoot.slice(0, -1) : resolvedRoot;
  if (resolvedPath === root) return true;
  return resolvedPath.startsWith(root + "/");
}
