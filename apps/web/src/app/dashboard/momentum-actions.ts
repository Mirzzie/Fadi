"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";
import { setCadence, startRest } from "@/lib/resilience/service";

export type CadencePeriod = "day" | "week";

/**
 * Let the user commit to a cadence on their OWN terms. This is autonomy, not a
 * quota: a small, sustainable target they choose beats an imposed one. We never
 * reward setting it (intent isn't motion) — it just shapes how Scout paces them.
 */
export async function setCommitmentCadence(input: {
  target: number;
  period: CadencePeriod;
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  // Guard against an over-ambitious target the user can't sustain.
  const target = Math.max(1, Math.min(input.target, input.period === "day" ? 5 : 20));

  try {
    await setCadence(user.id, target, input.period);
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: `Committed: ${target} quality ${target === 1 ? "application" : "applications"} per ${input.period}. You can change this anytime.`,
    };
  } catch (error) {
    logger.error("resilience.set_cadence_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

/**
 * Start a protected rest window. Momentum decay pauses and is preserved — rest
 * is a legitimate part of the work, never a lapse to recover from.
 */
export async function startRestPeriod(input: {
  days: number;
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const days = Math.max(1, Math.min(input.days, 14));
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  try {
    const outcome = await startRest(user.id, until);
    revalidatePath("/dashboard");
    return { ok: true, message: outcome.message };
  } catch (error) {
    logger.error("resilience.start_rest_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
