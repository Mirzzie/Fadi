import "server-only";

import { registerPortfolioSubscribers } from "@/lib/portfolio/subscribers";

/**
 * The addon manifest — the ONE place a feature plugs into the system.
 *
 * To add a capability that reacts to the rest of FadiOS you write
 * `lib/<your-feature>/subscribers.ts` and add one line here. You do not touch
 * evidence, learning, documents, or the AI layer. That is the whole point:
 * new feature = new folder + one line, not shotgun surgery across the codebase.
 *
 * Explicit over magic (no filesystem auto-scan): the wiring stays greppable and
 * tree-shakeable, and load order is obvious.
 */

let registered = false;

/** Idempotent: dev hot-reload and multiple entry points re-import this module. */
export function registerAllSubscribers(): void {
  if (registered) return;
  registered = true;

  registerPortfolioSubscribers();
  // ← new addons subscribe here.
}
