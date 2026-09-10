/**
 * Domain events — the extension seam of FadiOS.
 *
 * WHY THIS EXISTS
 * Features used to reach into each other directly (lib/ai imported 15 domains;
 * lib/ai ↔ lib/evidence was a genuine import cycle papered over with dynamic
 * `await import()`). That makes every new capability a shotgun-surgery edit
 * across existing features, and it violates the dependency rule: high-level
 * policy must not depend on low-level detail.
 *
 * THE RULE
 * A feature that CHANGES something publishes a fact ("this happened").
 * A feature that CARES subscribes. Publishers never import subscribers, and
 * subscribers never import each other. Adding an addon = a new folder with a
 * `subscribers.ts` + one line in `register.ts`. No core edits, no cycles.
 *
 * Events are FACTS (past tense), never commands. They carry ids, not objects,
 * so a subscriber re-reads current state and can't act on a stale snapshot.
 */

export type DomainEventMap = {
  /**
   * The user's evidence pool changed — the career source of truth moved.
   * Downstream projections (résumé, portfolio) are now potentially stale.
   */
  "evidence.changed": {
    userId: string;
    reason: "created" | "updated" | "deleted" | "extracted" | "learning_completed";
    /** Present for single-item changes; absent for bulk (e.g. pool extraction). */
    evidenceItemId?: string;
  };

  /** Portfolio content changed (curated, published, imported, synced). */
  "portfolio.changed": {
    userId: string;
    siteId: string;
    reason: "item_saved" | "item_deleted" | "seeded" | "synced" | "imported" | "reordered" | "confirmed";
  };

  /** A portfolio site went public / private. */
  "portfolio.published": {
    userId: string;
    siteId: string;
    handle: string;
    published: boolean;
  };
};

export type DomainEventName = keyof DomainEventMap;
export type DomainEventPayload<K extends DomainEventName> = DomainEventMap[K];
