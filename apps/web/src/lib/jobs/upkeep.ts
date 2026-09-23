import "server-only";

import { createJobsRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { getConfiguredJobSources } from "@/lib/data-sources/registry";
import { logger } from "@/lib/observability/logger";
import { getKv } from "@/lib/kv/store";
import { checkPostingLiveness } from "./liveness";
import { sweepJobsLiveness } from "./liveness-sweep";

/**
 * Keeping the board honest, away from the person's eyes.
 *
 * A closed posting is worse than no posting. It costs a fit check, a tailored CV, a cover
 * letter and the walk to the apply button before the site says "no longer accepting
 * applications" — which is the exact hour this product exists to give back.
 *
 * The board already probes what it is about to show, but only six at a time behind a
 * twelve-hour cache, so with thousands of postings it can never catch up and never touches the
 * ones nobody scrolled to. This runs in the background pass, where nobody is waiting, and does
 * the three things that actually retire a dead posting:
 *
 * 1. Postings from sources Fadi no longer has. Nothing can refresh or re-check them.
 * 2. Postings no source has listed in a fortnight. If the boards stopped carrying it, it is gone.
 * 3. A real liveness probe over the least-recently-checked, which is what catches the rest.
 */

const UNSEEN_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * How many postings to probe per pass.
 *
 * Sized to drain a backlog rather than keep pace with one: a board that has never been checked
 * has thousands waiting, and sixty a pass behind a six-hour throttle would take weeks — by
 * which time the answers are stale again. This runs detached from the response, so the person
 * waits for none of it.
 */
const PROBES_PER_PASS = 200;
const PROBE_BUDGET_MS = 120_000;

export type UpkeepResult = {
  /** Retired because their source is gone. */
  fromRetiredSources: number;
  /** Retired because no source has listed them lately. */
  unseen: number;
  /** Postings probed against the source this run. */
  checked: number;
  /** Probed and found closed. */
  closed: number;
};

export async function runJobUpkeep(
  options: { probes?: number; budgetMs?: number } = {}
): Promise<UpkeepResult> {
  const repo = createJobsRepository(getDatabase());
  const result: UpkeepResult = { fromRetiredSources: 0, unseen: 0, checked: 0, closed: 0 };

  try {
    const live = getConfiguredJobSources().map((source) => source.id);
    result.fromRetiredSources = await repo.expireJobsFromRetiredSources(live);
    result.unseen = await repo.archiveStaleLiveJobs(new Date(Date.now() - UNSEEN_MS));
  } catch (error) {
    logger.warn("jobs.upkeep.retire_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  try {
    const candidates = await repo.listForLivenessSweep(options.probes ?? PROBES_PER_PASS);
    result.checked = candidates.length;
    const closed = await sweepJobsLiveness(
      candidates,
      {
        check: checkPostingLiveness,
        persist: (id, state) => repo.setJobLiveness(id, state),
      },
      {
        // The board's caution is right at render time and wrong here: this is the pass that has
        // the time. Still bounded — a sweep that never ends is a sweep that never reports.
        maxProbes: options.probes ?? 60,
        budgetMs: options.budgetMs ?? 45_000,
        concurrency: 8,
        ttlMs: 12 * 60 * 60 * 1000,
      }
    );
    result.closed = closed.size;
  } catch (error) {
    logger.warn("jobs.upkeep.sweep_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  logger.info("jobs.upkeep.completed", { ...result });
  return result;
}

/** One line for the receipt, or nothing when a pass changed nothing worth saying. */
export function upkeepSummary(result: UpkeepResult): string {
  const retired = result.fromRetiredSources + result.unseen + result.closed;
  if (retired === 0) return "";
  const parts: string[] = [];
  if (result.closed > 0) parts.push(`${result.closed} had closed`);
  if (result.unseen > 0) parts.push(`${result.unseen} no board still lists`);
  if (result.fromRetiredSources > 0) {
    parts.push(`${result.fromRetiredSources} came from a source Fadi no longer uses`);
  }
  return `Took ${retired} dead posting${retired === 1 ? "" : "s"} off your board: ${parts.join(", ")}.`;
}

/** How often upkeep is worth doing. Short, because a closed posting costs an hour. */
const UPKEEP_EVERY_MS = 20 * 60 * 1000;

/**
 * Upkeep on its own clock, not the findings pass's.
 *
 * The background agent is throttled to six hours because finding new roles and telling someone
 * about them is not worth doing more often. Retiring dead postings is: it costs nothing to be
 * told, and every hour a closed role stays on the board is an hour someone can waste on it. So
 * this runs on a twenty-minute cadence of its own, whether or not the findings pass is due.
 */
export async function maybeRunJobUpkeep(): Promise<UpkeepResult | null> {
  try {
    // setNx, not get-then-set: two page loads at the same moment would both read "absent" and
    // both sweep, which is the duplicate-crawl race this store exists to prevent.
    const claimed = await getKv().setNx(
      "jobs:upkeep:last",
      String(Date.now()),
      Math.floor(UPKEEP_EVERY_MS / 1000)
    );
    if (!claimed) return null;
  } catch {
    // No cache is no reason to stop cleaning; it only means we may clean more often.
  }
  return runJobUpkeep();
}
