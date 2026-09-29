import "server-only";

import type { Application } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";
import { linkApplicationToWork } from "@/lib/work/domain-links";

/**
 * Reflect an already-authoritative application in the work kernel.
 *
 * Until the shared durable outbox owns this hand-off, failure is reported to telemetry without
 * turning a successful application write into a false failure that a retry could duplicate.
 */
export async function syncApplicationWork(userId: string, application: Application): Promise<void> {
  try {
    await linkApplicationToWork(getDatabase(), userId, application);
  } catch (error) {
    logger.warn("applications.work_link_failed", {
      userId,
      applicationId: application.id,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
