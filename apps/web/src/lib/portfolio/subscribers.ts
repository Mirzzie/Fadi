import "server-only";

import { revalidatePath } from "next/cache";

import { subscribe } from "@/lib/events/bus";
import { logger } from "@/lib/observability/logger";

/**
 * Portfolio's reactions to facts from elsewhere in FadiOS.
 *
 * This is the addon seam in practice: `lib/evidence` and `lib/learning` have NO
 * idea the portfolio exists — they just publish "evidence.changed". The portfolio
 * opts in here. Deleting this file removes the behaviour cleanly; adding a new
 * feature that also cares about evidence means a new file like this one, not an
 * edit to evidence/learning.
 *
 * Deliberately conservative: it does NOT auto-mutate the user's portfolio. Fadi's
 * ideology (honesty + user locus of control) says the system may *detect* and
 * *propose*, never silently rewrite someone's public site. So this only marks the
 * CMS view stale so the "Sync evidence" affordance reflects reality on next load.
 * The detect→propose→approve loop is built on top of this seam, not inside it.
 */
export function registerPortfolioSubscribers(): void {
  subscribe("evidence.changed", async ({ userId, reason }) => {
    // Re-render the CMS so the user sees there's new evidence to pull in.
    revalidatePath("/dashboard/portfolio");
    logger.info("portfolio.evidence_changed_noticed", { userId, reason });
  });
}
