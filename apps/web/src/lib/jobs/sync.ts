import "server-only";

import { createJobsRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { getKv } from "@/lib/kv/store";
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

// A live posting that hasn't reappeared in any sync for this long has almost
// certainly been pulled from the boards — age it out so it stops surfacing as
// "active" (a ghost job that wastes the user's time). Boards typically expire
// postings within ~30 days; we're a bit more aggressive.
const JOB_FRESHNESS_MS = 14 * 24 * 60 * 60 * 1000;
const SYNC_TTL_SECONDS = Math.ceil(SYNC_TTL_MS / 1000);

// The sync window lives in the shared KV so multiple instances don't duplicate
// external pulls. Invalidation uses GENERATION COUNTERS (a KV can't prefix-delete):
// bumping the role or global generation changes every affected key, which is
// equivalent to clearing those windows.
async function syncKey(profile: RelevanceProfile, location?: LocationFilter): Promise<string> {
  const kv = getKv();
  const [roleGen, globalGen] = await Promise.all([
    kv.get(`jobsync-gen:${profile.targetRole}`),
    kv.get("jobsync-gen:*"),
  ]);
  return `jobsync:${globalGen ?? 0}:${roleGen ?? 0}:${profile.targetRole}::${profile.region ?? ""}::${location?.country ?? ""}::${location?.city ?? ""}`;
}

/**
 * Drop the cached sync window so the next jobs load re-pulls live postings. Called
 * when the user creates or switches their active direction, so the jobs they see
 * follow the NEW direction immediately instead of waiting out the TTL. Pass a role
 * to target just that direction; omit to clear all. Fire-and-forget by design.
 */
export function invalidateJobSync(targetRole?: string): void {
  const key = targetRole ? `jobsync-gen:${targetRole}` : "jobsync-gen:*";
  void getKv()
    .incr(key)
    .catch(() => {
      /* best-effort — worst case the old TTL window plays out */
    });
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
  const kv = getKv();
  const key = await syncKey(profile, location);
  if (await kv.get(key)) return 0;

  // Reserve the window up front so concurrent requests don't all fan out.
  await kv.set(key, "1", SYNC_TTL_SECONDS);

  try {
    const postings = await discoverJobs(profile, 30, location);
    if (postings.length === 0) {
      // Nothing live came back — don't archive the seed, leave the user with
      // *something*. Shrink the window so we retry sooner than the full TTL.
      await kv.set(key, "1", 60);
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

    // Age out postings that haven't been re-seen in a while — they've likely
    // closed on the source, and a stale "active" job wastes the user's time.
    const expired = await jobsRepository.archiveStaleLiveJobs(
      new Date(Date.now() - JOB_FRESHNESS_MS),
    );

    logger.info("jobs.sync.completed", {
      targetRole: profile.targetRole,
      discovered: postings.length,
      upserted,
      seedArchived: archived,
      staleExpired: expired,
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
