import type { MomentumBand } from "./engine";

/**
 * Momentum reflection — the honest "how am I really doing?" read.
 *
 * Two healthy, un-fakeable mechanics from the platform ideology
 * (platform-ideology-resilience):
 *  1. YOU vs YOUR PAST SELF — never other users. Compares this week's forward
 *     motion to the distribution of the user's OWN past weeks. The only honest,
 *     non-toxic comparison: there's no leaderboard to farm.
 *  2. A morale read — detects a struggling/quiet stretch and responds with the
 *     psychological-lens mandate: validate the difficulty truthfully, never shame
 *     a dip, and always leave ONE small controllable next step.
 *
 * All pure + deterministic, so it's unit-testable; the service feeds it the ledger.
 */

export type MoraleState = "thriving" | "steady" | "quiet" | "struggling";
export type PastSelfTrend = "up" | "down" | "flat" | "new";

export type MomentumReflection = {
  pastSelf: { percentile: number | null; trend: PastSelfTrend; line: string };
  morale: { state: MoraleState; line: string; nextStep: string };
};

export type EventLite = { createdAt: string | Date; momentumDelta: number; kind: string };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Forward motion earned per week over the last `weeks`, oldest → newest (the last
 * entry is the current week). Only positive deltas count — this is effort, not a
 * vanity curve.
 */
export function bucketWeeklyMotion(events: EventLite[], now: Date = new Date(), weeks = 12): number[] {
  const buckets = new Array<number>(weeks).fill(0);
  const nowMs = now.getTime();
  for (const e of events) {
    const ageWeeks = Math.floor((nowMs - new Date(e.createdAt).getTime()) / WEEK_MS);
    if (ageWeeks >= 0 && ageWeeks < weeks) {
      buckets[weeks - 1 - ageWeeks] += Math.max(0, e.momentumDelta);
    }
  }
  return buckets;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Where this week stands against the user's own history. Honest about thin data:
 * trims weeks before their first activity, and needs ≥3 prior weeks before it
 * claims a percentile (otherwise "new" — still building a baseline).
 */
export function pastSelfStanding(buckets: number[]): { percentile: number | null; trend: PastSelfTrend; line: string } {
  const firstActive = buckets.findIndex((b) => b > 0);
  if (firstActive === -1) {
    return {
      percentile: null,
      trend: "new",
      line: "No forward motion logged yet — your baseline starts with your first move.",
    };
  }

  const active = buckets.slice(firstActive);
  const latest = active[active.length - 1];
  const prior = active.slice(0, -1);

  if (prior.length < 3) {
    return {
      percentile: null,
      trend: "new",
      line: "Still building your baseline — a few more weeks and I'll show you how you're trending against your own past.",
    };
  }

  const le = prior.filter((p) => p <= latest).length;
  const percentile = Math.round((le / prior.length) * 100);
  const med = median(prior);
  const trend: PastSelfTrend = latest > med * 1.1 ? "up" : latest < med * 0.9 ? "down" : "flat";

  let line: string;
  if (latest === 0) {
    line = "Quiet week so far — below your usual pace. Your own history says you restart; one small move does it.";
  } else if (percentile >= 60) {
    line = `Strong week — more forward motion than ${percentile}% of your past weeks. This is you at your best.`;
  } else if (percentile >= 35) {
    line = "A steady week — right around your own normal. Consistency is the win.";
  } else {
    line = "Quieter than your usual lately. That's information, not a verdict — one small move tips it back up.";
  }
  return { percentile, trend, line };
}

export type MoraleInput = {
  band: MomentumBand;
  isResting: boolean;
  recentRejections: number;
  recentAutopsies: number;
  daysSinceLastAction: number;
};

/** The honest, locus-of-control morale read. Never shames; always leaves one step. */
export function moraleRead(input: MoraleInput): { state: MoraleState; line: string; nextStep: string } {
  const { band, isResting, recentRejections, recentAutopsies, daysSinceLastAction } = input;

  if (isResting) {
    return {
      state: "quiet",
      line: "You're in a rest window you chose — momentum is protected, nothing is slipping.",
      nextStep: "When you're ready, one small tailored move beats a big catch-up. No rush.",
    };
  }

  const lowBand = band === "dormant" || band === "warming";
  const unprocessedNo = recentRejections >= 2 && recentAutopsies < recentRejections;

  if (lowBand && (unprocessedNo || daysSinceLastAction >= 7)) {
    return {
      state: "struggling",
      line: "This stretch looks hard, and that's real — a slow search is the market, not a measure of you.",
      nextStep: unprocessedNo
        ? "Turn one recent 'no' into a lesson — a two-minute rejection autopsy is your highest-return move and sharpens the next application."
        : "One small move today restarts everything: a single tailored application, or one referral ask. That's enough.",
    };
  }

  if (daysSinceLastAction >= 4) {
    return {
      state: "quiet",
      line: "It's been quiet — and that's okay. No pressure, no catch-up debt.",
      nextStep: "One small step is waiting whenever you are: a referral ask, or one tailored application.",
    };
  }

  if (band === "peak" || band === "strong") {
    return {
      state: "thriving",
      line: "You're running a genuinely strong process — this is what consistency looks like.",
      nextStep: "Protect it: hold the cadence you set, and remember rest counts as part of the work.",
    };
  }

  return {
    state: "steady",
    line: "You're building — progress in a search is rarely linear, and you're doing the things you control.",
    nextStep:
      recentRejections > recentAutopsies
        ? "If a recent 'no' is still unprocessed, a quick autopsy turns it into your next edge."
        : "Keep one small move going today — consistency compounds before the results show.",
  };
}

export function buildReflection(input: {
  buckets: number[];
  band: MomentumBand;
  isResting: boolean;
  recentRejections: number;
  recentAutopsies: number;
  daysSinceLastAction: number;
}): MomentumReflection {
  return {
    pastSelf: pastSelfStanding(input.buckets),
    morale: moraleRead(input),
  };
}
