/**
 * Resilience & Momentum Engine — pure logic.
 *
 * Design principle (see PLATFORM_IDEOLOGY "Momentum is a health metric"):
 * we score the PROCESS, never the OUTCOME. Every reward here is for something
 * the user controls. This is what makes the system honest and un-fakeable —
 * there is no "points for rejections" to farm, because the reward lands on the
 * forward motion around a rejection (the autopsy), not on the rejection itself.
 *
 * No shame cliff: momentum decays gently and never resets to zero. Rest is
 * protected. The only comparison is you-vs-your-past-self — never other users.
 */

export const MOMENTUM_MIN = 0;
export const MOMENTUM_MAX = 100;

/** Gentle daily decay when idle. Low on purpose — missing a day must not feel punishing. */
export const DECAY_PER_DAY = 3;

/** A dip of this many days before a return counts as a rewarded "comeback". */
export const COMEBACK_GAP_DAYS = 4;

export type ForwardMotionKind =
  | "quality_application"
  | "rejection_logged"
  | "rejection_autopsy"
  | "skill_closed"
  | "referral_added"
  | "rest_day"
  | "comeback";

/**
 * Momentum deltas. Note the deliberate shape:
 * - `rejection_logged` is tiny (+2): we acknowledge the courage to face and
 *   record a "no", but we do NOT reward the rejection.
 * - `rejection_autopsy` is large (+10): the real reward is for LEARNING from it.
 * - `referral_added` is highest (+18): 1 referral ≈ 40 cold applications.
 * Faking a rejection nets +2 and still requires real reflective work to earn
 * the rest — and nothing is fakeable for external value (no leaderboard).
 */
export const MOMENTUM_DELTAS: Record<ForwardMotionKind, number> = {
  quality_application: 12,
  rejection_logged: 2,
  rejection_autopsy: 10,
  skill_closed: 15,
  referral_added: 18,
  rest_day: 0, // earns nothing but protects momentum (see applyRest)
  comeback: 8,
};

export function clampMomentum(value: number): number {
  return Math.max(MOMENTUM_MIN, Math.min(MOMENTUM_MAX, Math.round(value)));
}

/** Whole days between two instants (never negative). */
function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return ms <= 0 ? 0 : ms / (1000 * 60 * 60 * 24);
}

export type MomentumSnapshot = {
  momentum: number;
  lastActionAt: Date | null;
  restingUntil: Date | null;
};

/**
 * Apply gentle time decay to a stored momentum value. Decay is paused while the
 * user is in a deliberate rest window (Fadi protects momentum during recovery),
 * and momentum floors at MOMENTUM_MIN — it never collapses to a punishing zero.
 */
export function decayMomentum(snapshot: MomentumSnapshot, now: Date = new Date()): number {
  if (!snapshot.lastActionAt) return clampMomentum(snapshot.momentum);

  let elapsedDays = daysBetween(snapshot.lastActionAt, now);

  // Subtract any protected rest that overlaps the idle window.
  if (snapshot.restingUntil) {
    const restEnd = snapshot.restingUntil < now ? snapshot.restingUntil : now;
    const restDays = daysBetween(snapshot.lastActionAt, restEnd);
    elapsedDays = Math.max(0, elapsedDays - restDays);
  }

  return clampMomentum(snapshot.momentum - elapsedDays * DECAY_PER_DAY);
}

/**
 * Whether a return from idle qualifies for a comeback reward. Rewarding the
 * return (not punishing the absence) is the healthy inversion of streak loss.
 */
export function isComeback(lastActionAt: Date | null, now: Date = new Date()): boolean {
  if (!lastActionAt) return false;
  return daysBetween(lastActionAt, now) >= COMEBACK_GAP_DAYS;
}

export type ApplyMotionResult = {
  momentum: number;
  delta: number;
  awardedComeback: boolean;
};

/**
 * Compute the new momentum after a forward-motion action. Decays the prior
 * value to "now" first, then adds the action's delta, plus a comeback bonus if
 * the user is returning after a dip.
 */
export function applyForwardMotion(
  snapshot: MomentumSnapshot,
  kind: ForwardMotionKind,
  now: Date = new Date(),
): ApplyMotionResult {
  const decayed = decayMomentum(snapshot, now);
  const baseDelta = MOMENTUM_DELTAS[kind];

  const awardedComeback = kind !== "comeback" && isComeback(snapshot.lastActionAt, now);
  const comebackBonus = awardedComeback ? MOMENTUM_DELTAS.comeback : 0;

  const totalDelta = baseDelta + comebackBonus;

  return {
    momentum: clampMomentum(decayed + totalDelta),
    delta: totalDelta,
    awardedComeback,
  };
}

export type MomentumBand = "dormant" | "warming" | "building" | "strong" | "peak";

export function momentumBand(momentum: number): MomentumBand {
  if (momentum >= 85) return "peak";
  if (momentum >= 65) return "strong";
  if (momentum >= 40) return "building";
  if (momentum >= 15) return "warming";
  return "dormant";
}

export type CadenceAdherence = "ahead" | "on_track" | "behind" | "resting" | "unset";

/**
 * Adherence to the user's OWN committed cadence — never an imposed quota.
 * Resting deliberately is a valid state, not a failure.
 */
export function cadenceAdherence(params: {
  cadenceTarget: number | null;
  qualityApplicationsThisPeriod: number;
  isResting: boolean;
}): CadenceAdherence {
  if (params.isResting) return "resting";
  if (!params.cadenceTarget || params.cadenceTarget <= 0) return "unset";

  const ratio = params.qualityApplicationsThisPeriod / params.cadenceTarget;
  if (ratio >= 1) return "ahead";
  if (ratio >= 0.5) return "on_track";
  return "behind";
}
