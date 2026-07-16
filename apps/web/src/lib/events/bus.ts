import type { DomainEventName, DomainEventPayload } from "./types";

/**
 * In-process, typed domain event bus.
 *
 * DESIGN DECISIONS (and their reasons):
 *
 * 1. In-process, awaited. Publishing awaits its subscribers so their side effects
 *    (cache revalidation, derived writes) finish before the server action returns
 *    and the UI re-reads. This is deliberately NOT a background queue: Next server
 *    actions are request-scoped, and work started but not awaited can be killed
 *    when the request ends. Cross-request/retryable work belongs on a real queue
 *    later — `publish` is the seam we'd point at it, with no caller changes.
 *
 * 2. Subscriber failures are ISOLATED. A publisher is reporting a fact that already
 *    happened; a broken listener must never fail the user's write. We settle all
 *    handlers and log failures rather than throwing. (Without this, adding an addon
 *    could break saving evidence — exactly the coupling we're removing.)
 *
 * 3. Handlers run concurrently and must be order-independent. If two subscribers
 *    need ordering, that's a single subscriber with two steps.
 */

type Handler<K extends DomainEventName> = (payload: DomainEventPayload<K>) => void | Promise<void>;

// Handlers are stored loosely; `subscribe`/`publish` enforce the types at the edges.
type AnyHandler = (payload: never) => void | Promise<void>;

const handlers = new Map<DomainEventName, Set<AnyHandler>>();

/** Subscribe to an event. Returns an unsubscribe fn (used by tests + hot reload). */
export function subscribe<K extends DomainEventName>(event: K, handler: Handler<K>): () => void {
  const set = handlers.get(event) ?? new Set<AnyHandler>();
  set.add(handler as AnyHandler);
  handlers.set(event, set);
  return () => {
    set.delete(handler as AnyHandler);
  };
}

/**
 * Publish a fact. Never throws — a failing subscriber is logged, not propagated.
 * Awaits all subscribers so their effects land before the caller returns.
 */
export async function publish<K extends DomainEventName>(
  event: K,
  payload: DomainEventPayload<K>,
): Promise<void> {
  const set = handlers.get(event);
  if (!set || set.size === 0) return;

  const results = await Promise.allSettled(
    [...set].map(async (h) => (h as unknown as Handler<K>)(payload)),
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    // Lazy import keeps this module dependency-free (the bus must not pull the
    // world in — it's imported by every feature).
    const { logger } = await import("@/lib/observability/logger");
    for (const f of failures) {
      logger.error("events.subscriber_failed", {
        event,
        error: (f as PromiseRejectedResult).reason instanceof Error
          ? ((f as PromiseRejectedResult).reason as Error).message
          : String((f as PromiseRejectedResult).reason),
      });
    }
  }
}

/** Test-only: drop all handlers so suites don't leak into each other. */
export function __resetBusForTests(): void {
  handlers.clear();
}

/** Test/diagnostics: how many handlers are attached to an event. */
export function subscriberCount(event: DomainEventName): number {
  return handlers.get(event)?.size ?? 0;
}
