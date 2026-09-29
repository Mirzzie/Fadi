import "server-only";

import { after } from "next/server";

import { createOutboxRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";

import { outboxHandlers } from "./handlers";
import { drainOutboxWith, type DrainResult } from "./worker";

/** Deliver whatever is due. Safe to call from anywhere, any number of times at once. */
export async function drainOutbox(): Promise<DrainResult> {
  const db = getDatabase();
  const result = await drainOutboxWith(createOutboxRepository(db), outboxHandlers(db));
  if (result.failed > 0) logger.warn("outbox.deliveries_failed", { ...result });
  return result;
}

/**
 * Deliver after the response. Producers call this once they commit, so the consequence usually
 * lands within the same request's lifetime; anything that fails waits for its backoff and the
 * next kick (every Today load also kicks), so nothing depends on this one attempt.
 */
export function kickOutbox(): void {
  const run = () =>
    drainOutbox().catch((error) =>
      logger.error("outbox.drain_failed", {
        error: error instanceof Error ? error.message : "unknown",
      })
    );
  try {
    after(run);
  } catch {
    void run(); // outside a request scope (a background caller)
  }
}
