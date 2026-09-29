import type { OutboxEvent } from "@careeros/database";

/**
 * THE ONE WORKER.
 *
 * Takes a batch of due events, runs each through its topic's handler, and records the result:
 * done, or another try later. Handlers must be idempotent — an event is delivered at least once,
 * and a lease that lapses mid-handler (a slow provider, a restart) delivers it again.
 *
 * Pure orchestration with the store and handlers injected, so the retry rules are tested
 * without a database; lib/outbox/index.ts wires the real ones.
 */

export type OutboxStore = {
  claim(limit: number): Promise<OutboxEvent[]>;
  complete(id: string): Promise<void>;
  fail(event: Pick<OutboxEvent, "id" | "attempts">, error: string): Promise<void>;
};

export type OutboxHandler = (event: OutboxEvent) => Promise<void>;

export type DrainResult = { delivered: number; failed: number };

export async function drainOutboxWith(
  store: OutboxStore,
  handlers: Record<string, OutboxHandler>,
  options: { batch?: number; maxBatches?: number } = {}
): Promise<DrainResult> {
  const batch = options.batch ?? 20;
  const maxBatches = options.maxBatches ?? 5;
  const result: DrainResult = { delivered: 0, failed: 0 };

  for (let round = 0; round < maxBatches; round++) {
    const events = await store.claim(batch);
    if (events.length === 0) break;
    for (const event of events) {
      const handler = handlers[event.topic];
      try {
        // An unknown topic is a deploy mismatch, not a transient fault — but it still retries,
        // because the code that knows the topic may be one deploy away.
        if (!handler) throw new Error(`No handler for "${event.topic}".`);
        await handler(event);
        await store.complete(event.id);
        result.delivered++;
      } catch (error) {
        await store.fail(event, error instanceof Error ? error.message : String(error));
        result.failed++;
      }
    }
    if (events.length < batch) break;
  }
  return result;
}
