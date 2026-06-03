"use server";

import { createApplicationsRepository } from "@careeros/database";
import { revalidatePath } from "next/cache";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";
import {
  completeRejectionAutopsy,
  logRejection,
  type LogRejectionResult,
} from "@/lib/resilience/service";

export type RejectionStage = "keyword" | "screen" | "interview" | "final";

function workspacePath(jobId: string) {
  return `/dashboard/applications/${jobId}/workspace`;
}

/**
 * Mark an application as sent. This is the provenance precondition for logging a
 * rejection — momentum is intentionally NOT awarded here (clicking a button is
 * not forward motion). It only records the honest fact that the application went
 * out, so a later rejection can be verified and learned from.
 */
export async function markApplicationApplied(input: {
  jobId: string;
  company: string;
  title: string;
  url?: string | null;
}): Promise<{ ok: boolean; applicationId?: string; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    const application = await createApplicationsRepository(getDatabase()).upsertStatusForUser(
      user.id,
      {
        jobId: input.jobId,
        company: input.company,
        title: input.title,
        url: input.url ?? null,
        status: "applied",
      },
    );

    revalidatePath(workspacePath(input.jobId));
    return { ok: true, applicationId: application.id, message: "Marked as applied." };
  } catch (error) {
    logger.error("applications.mark_applied_failed", {
      userId: user.id,
      jobId: input.jobId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

/** Log a rejection against a real, sent application and open the autopsy. */
export async function logApplicationRejection(input: {
  jobId: string;
  applicationId: string;
  stage: RejectionStage | null;
}): Promise<LogRejectionResult> {
  const user = await getCurrentAuthUser();
  if (!user) {
    return { ok: false, reason: "not_found", message: "Please sign in again." };
  }

  const result = await logRejection(user.id, input.applicationId, input.stage);
  if (result.ok) revalidatePath(workspacePath(input.jobId));
  return result;
}

/** Submit the rejection autopsy — where the real, process-based reward lands. */
export async function submitRejectionAutopsy(input: {
  jobId: string;
  applicationId: string;
  reflection: { stage?: string; feedback?: string; lesson?: string; nextAction?: string };
}): Promise<
  | { ok: true; message: string; momentum: number; delta: number; band: string }
  | { ok: false; message: string }
> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    const motion = await completeRejectionAutopsy(user.id, input.applicationId, input.reflection);
    revalidatePath(workspacePath(input.jobId));
    return {
      ok: true,
      message: motion.message,
      momentum: motion.momentum,
      delta: motion.delta,
      band: motion.band,
    };
  } catch (error) {
    logger.error("applications.autopsy_failed", {
      userId: user.id,
      applicationId: input.applicationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Something went wrong saving your reflection. Please try again." };
  }
}
