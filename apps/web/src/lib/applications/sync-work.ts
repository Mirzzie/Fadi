import "server-only";

import type { Application } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";
import { kickOutbox } from "@/lib/outbox";
import { enqueueOutbox } from "@/lib/outbox/topics";

/**
 * Reflect an already-authoritative application in the work kernel, through the outbox.
 *
 * The link used to run inline and was lost whenever it failed. It is now queued and delivered
 * with retries. The key includes the application's updatedAt, so each change is one delivery and
 * a repeated call for the same change is none. Queueing failure is reported without turning a
 * successful application write into a false failure that a retry could duplicate.
 */
export async function syncApplicationWork(userId: string, application: Application): Promise<void> {
  try {
    const stamp = new Date(application.updatedAt ?? Date.now()).toISOString();
    await enqueueOutbox(
      getDatabase(),
      userId,
      "application.changed",
      { applicationId: application.id },
      `${application.id}:${stamp}`
    );
    kickOutbox();
  } catch (error) {
    logger.warn("applications.work_link_failed", {
      userId,
      applicationId: application.id,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
