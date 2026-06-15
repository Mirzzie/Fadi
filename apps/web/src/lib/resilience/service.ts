import "server-only";

import { createResilienceRepository, type ResilienceEvent } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";
import {
  applyForwardMotion,
  cadenceAdherence,
  decayMomentum,
  momentumBand,
  type CadenceAdherence,
  type ForwardMotionKind,
  type MomentumBand,
} from "./engine";
import {
  REJECTION_AUTOPSY_PROMPTS,
  anomalyNudge,
  cadenceMessage,
  forwardMotionMessage,
  momentumMessage,
} from "./framing";

function repo() {
  return createResilienceRepository(getDatabase());
}

function periodStart(period: string, now: Date): Date {
  const days = period === "month" ? 30 : period === "day" ? 1 : 7;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export type MomentumSummary = {
  momentum: number;
  peakMomentum: number;
  band: MomentumBand;
  bandMessage: string;
  isResting: boolean;
  cadenceTarget: number | null;
  cadencePeriod: string;
  cadenceAdherence: CadenceAdherence;
  cadenceMessage: string;
  qualityApplicationsThisPeriod: number;
  recentEvents: ResilienceEvent[];
};

/** The read model for the dashboard and for Fadi's context. Decays to "now". */
export async function getMomentumSummary(userId: string): Promise<MomentumSummary> {
  const r = repo();
  const state = await r.ensureMomentumState(userId);
  const now = new Date();

  const momentum = decayMomentum(
    { momentum: state.momentum, lastActionAt: state.lastActionAt, restingUntil: state.restingUntil },
    now,
  );

  const isResting = Boolean(state.restingUntil && state.restingUntil > now);
  const qualityApplicationsThisPeriod = await r.countEventsSince(
    userId,
    "quality_application",
    periodStart(state.cadencePeriod, now),
  );

  const adherence = cadenceAdherence({
    cadenceTarget: state.cadenceTarget,
    qualityApplicationsThisPeriod,
    isResting,
  });

  const band = momentumBand(momentum);

  return {
    momentum,
    peakMomentum: state.peakMomentum,
    band,
    bandMessage: momentumMessage(band),
    isResting,
    cadenceTarget: state.cadenceTarget,
    cadencePeriod: state.cadencePeriod,
    cadenceAdherence: adherence,
    cadenceMessage: cadenceMessage(adherence),
    qualityApplicationsThisPeriod,
    recentEvents: await r.listRecentEvents(userId, 12),
  };
}

export type ForwardMotionOutcome = {
  momentum: number;
  delta: number;
  awardedComeback: boolean;
  band: MomentumBand;
  message: string;
};

/**
 * Record a controllable forward-motion action and update momentum. This is the
 * single chokepoint through which all rewards flow — every reward is for the
 * process, never an outcome.
 */
export async function recordForwardMotion(
  userId: string,
  kind: ForwardMotionKind,
  opts: { applicationId?: string; metadata?: Record<string, unknown> } = {},
): Promise<ForwardMotionOutcome> {
  const r = repo();
  const state = await r.ensureMomentumState(userId);
  const now = new Date();

  const result = applyForwardMotion(
    { momentum: state.momentum, lastActionAt: state.lastActionAt, restingUntil: state.restingUntil },
    kind,
    now,
  );

  await r.recordEvent({
    userId,
    kind,
    momentumDelta: result.delta,
    applicationId: opts.applicationId ?? null,
    metadata: opts.metadata ?? {},
  });

  await r.updateMomentumState(userId, {
    momentum: result.momentum,
    peakMomentum: Math.max(state.peakMomentum, result.momentum),
    lastActionAt: now,
  });

  logger.info("resilience.forward_motion", {
    userId,
    kind,
    delta: result.delta,
    momentum: result.momentum,
    awardedComeback: result.awardedComeback,
  });

  return {
    momentum: result.momentum,
    delta: result.delta,
    awardedComeback: result.awardedComeback,
    band: momentumBand(result.momentum),
    message: forwardMotionMessage(kind),
  };
}

export type LogRejectionResult =
  | { ok: false; reason: "not_found" | "not_sent"; message: string }
  | {
      ok: true;
      autopsyPrompts: typeof REJECTION_AUTOPSY_PROMPTS;
      motion: ForwardMotionOutcome;
      anomalyNudge: string | null;
    };

/**
 * Log a rejection against a REAL, already-sent application (provenance gating).
 * The reward here is tiny — courage to face the "no". The real reward comes
 * from completing the autopsy. A rejection on a never-sent application is
 * rejected outright, which is the first line of defence against fake farming.
 */
export async function logRejection(
  userId: string,
  applicationId: string,
  stage: "keyword" | "screen" | "interview" | "final" | null = null,
): Promise<LogRejectionResult> {
  const r = repo();
  const application = await r.getApplicationForUser(userId, applicationId);

  if (!application) {
    return {
      ok: false,
      reason: "not_found",
      message: "I can't find that application under your account.",
    };
  }

  if (!application.appliedAt) {
    return {
      ok: false,
      reason: "not_sent",
      message:
        "Let's mark this application as sent first — a rejection only makes sense (and only helps me find patterns) once the application actually went out.",
    };
  }

  await r.setApplicationOutcome(applicationId, {
    outcome: "rejected",
    rejectionStage: stage,
    status: "rejected",
  });

  const motion = await recordForwardMotion(userId, "rejection_logged", {
    applicationId,
    metadata: { stage },
  });

  // Honest anomaly check — invite, never accuse.
  const [rejectionsLogged, sentApplications] = await Promise.all([
    r.countEventsSince(userId, "rejection_logged", periodStart("month", new Date())),
    r.countSentApplications(userId),
  ]);

  const nudge =
    rejectionsLogged > Math.max(3, sentApplications)
      ? anomalyNudge(rejectionsLogged, sentApplications)
      : null;

  return { ok: true, autopsyPrompts: REJECTION_AUTOPSY_PROMPTS, motion, anomalyNudge: nudge };
}

/** Complete the rejection autopsy — where the real forward-motion reward lands. */
export async function completeRejectionAutopsy(
  userId: string,
  applicationId: string,
  reflection: { stage?: string; feedback?: string; lesson?: string; nextAction?: string },
): Promise<ForwardMotionOutcome> {
  return recordForwardMotion(userId, "rejection_autopsy", {
    applicationId,
    metadata: { ...reflection },
  });
}

/** Let the user set a sustainable cadence on their own terms. */
export async function setCadence(
  userId: string,
  cadenceTarget: number,
  cadencePeriod: "day" | "week" | "month" = "week",
): Promise<void> {
  const r = repo();
  await r.ensureMomentumState(userId);
  await r.updateMomentumState(userId, { cadenceTarget, cadencePeriod });
}

/** Start a protected rest window — decay pauses, momentum is preserved. */
export async function startRest(userId: string, until: Date): Promise<ForwardMotionOutcome> {
  const r = repo();
  await r.ensureMomentumState(userId);
  await r.updateMomentumState(userId, { restingUntil: until });
  return recordForwardMotion(userId, "rest_day", { metadata: { until: until.toISOString() } });
}

/**
 * A real momentum sparkline: forward-motion earned per day over the last `days`
 * (oldest → newest). Process activity, not a vanity curve — empty days are 0.
 */
export async function getMomentumSparkline(userId: string, days = 10): Promise<number[]> {
  const r = repo();
  const events = await r.listRecentEvents(userId, 100);
  const now = Date.now();
  const buckets = new Array<number>(days).fill(0);

  for (const event of events) {
    const ageDays = Math.floor((now - new Date(event.createdAt).getTime()) / (24 * 60 * 60 * 1000));
    if (ageDays >= 0 && ageDays < days) {
      // oldest day on the left, today on the right
      buckets[days - 1 - ageDays] += Math.max(0, event.momentumDelta);
    }
  }

  return buckets;
}
