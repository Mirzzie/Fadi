import "server-only";

import { createJobsRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { discoverJobs, type LocationFilter } from "@/lib/data-sources/service";
import type { RelevanceProfile } from "@/lib/data-sources/relevance";
import type { JobPosting } from "@/lib/data-sources/types";
import { logger } from "@/lib/observability/logger";

/**
 * Live job ingestion. Fans out to the configured job sources (Remotive,
 * Arbeitnow, … keyed ones as they're added), normalizes each posting, and
 * upserts it into the `jobs` table so the existing match / save / apply flow
 * keeps working unchanged — but now on real, current postings instead of seed
 * rows. The first time live jobs land we archive the local MVP seed so users
 * never see fabricated companies again.
 */

const SOURCE_SEED = "local_mvp_seed";

// Refreshing hits external APIs (~8s worst case), so we only do it when the
// last sync for a profile is older than this. Subsequent page loads read the
// already-persisted rows instantly.
const SYNC_TTL_MS = 30 * 60 * 1000;
const lastSyncByKey = new Map<string, number>();

function syncKey(profile: RelevanceProfile, location?: LocationFilter): string {
  return `${profile.targetRole}::${profile.region ?? ""}::${location?.country ?? ""}::${location?.city ?? ""}`;
}

function toRemoteMode(posting: JobPosting): string | null {
  return posting.remote ? "remote" : null;
}

/**
 * Ensure the `jobs` table holds fresh live postings for this profile. Best
 * effort: any source failure is swallowed (we keep whatever is already stored)
 * so a flaky external API never breaks the dashboard. Returns how many postings
 * were upserted this call (0 when served from the TTL window).
 */
export async function ensureFreshLiveJobs(
  profile: RelevanceProfile,
  location?: LocationFilter,
): Promise<number> {
  const key = syncKey(profile, location);
  const last = lastSyncByKey.get(key) ?? 0;
  if (Date.now() - last < SYNC_TTL_MS) return 0;

  // Reserve the window up front so concurrent requests don't all fan out.
  lastSyncByKey.set(key, Date.now());

  try {
    const postings = await discoverJobs(profile, 30, location);
    if (postings.length === 0) {
      // Nothing live came back — don't archive the seed, leave the user with
      // *something*. Re-open the window so we retry sooner than the full TTL.
      lastSyncByKey.set(key, Date.now() - (SYNC_TTL_MS - 60_000));
      return 0;
    }

    const db = getDatabase();
    const jobsRepository = createJobsRepository(db);

    let upserted = 0;
    for (const posting of postings) {
      try {
        await jobsRepository.upsertSeedJob({
          source: posting.sourceId,
          externalId: posting.externalId,
          title: posting.title,
          company: posting.company,
          location: posting.location ?? null,
          remoteMode: toRemoteMode(posting),
          description: posting.description ?? null,
          url: posting.url ?? null,
          salaryText: posting.salaryText ?? null,
          status: "active",
          postedAt: posting.postedAt ? new Date(posting.postedAt) : null,
          rawPayload: { tags: posting.tags, sourceId: posting.sourceId },
        });
        upserted += 1;
      } catch (err) {
        logger.warn("jobs.sync.upsert_failed", {
          source: posting.sourceId,
          externalId: posting.externalId,
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    // Real postings are now live — retire the fabricated MVP seed for good.
    const archived = await jobsRepository.deactivateBySource(SOURCE_SEED);

    logger.info("jobs.sync.completed", {
      targetRole: profile.targetRole,
      discovered: postings.length,
      upserted,
      seedArchived: archived,
    });

    return upserted;
  } catch (err) {
    logger.warn("jobs.sync.failed", {
      targetRole: profile.targetRole,
      error: err instanceof Error ? err.message : "unknown",
    });
    return 0;
  }
}
