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

/**
 * The normalized identity of a search — role, domain, resolved geography, and the
 * worldwide flag. The SAME fingerprint keys the lock, the status record, and (later) the
 * result set, so a Dublin-default search and a Dublin-profile WORLDWIDE search no longer
 * collide (they run different queries against different sources), and domain — which changes
 * WHICH sources run — is part of the identity. Lowercased/trimmed so trivial casing differences
 * don't fork the cache.
 */
function scopeFingerprint(profile: RelevanceProfile, location?: LocationFilter): string {
  const worldwide = location?.worldwide === true;
  return [
    profile.targetRole ?? "",
    profile.domain ?? "",
    profile.region ?? "",
    worldwide ? "worldwide" : "local",
    worldwide ? "" : (location?.country ?? ""),
    worldwide ? "" : (location?.city ?? ""),
  ]
    .map((s) => s.toLowerCase().trim())
    .join("::");
}

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
  return `jobsync:${globalGen ?? 0}:${roleGen ?? 0}:${scopeFingerprint(profile, location)}`;
}

/**
 * Drop the cached sync window so the next jobs load re-pulls live postings. Called when the
 * user creates/switches their active direction, or runs an explicit search that should FETCH
 * rather than read the TTL cache. Pass a role to target just that direction; omit ONLY to
 * clear everyone (reserve for admin/global resets — an explicit user search must pass its role).
 *
 * AWAITABLE by design: the caller navigates (or revalidates) right after, and the next page
 * load reads the generation counter to build its sync key — so the increment MUST land before
 * that read, or the new page sees the old generation, finds the window still reserved, and
 * skips the search. Awaiting closes that race.
 */
export async function invalidateJobSync(targetRole?: string): Promise<void> {
  const key = targetRole ? `jobsync-gen:${targetRole}` : "jobsync-gen:*";
  try {
    await getKv().incr(key);
  } catch {
    /* best-effort — worst case the old TTL window plays out */
  }
}

function toRemoteMode(posting: JobPosting): string | null {
  return posting.remote ? "remote" : null;
}

/**
 * Live status of a background discovery run, so the Jobs page can show "Fadi is
 * searching the web… N found" and auto-refresh until it completes — instead of a
 * fast-but-empty board. Stored in KV keyed per profile+location so a reload reads
 * the run kicked off by the previous load.
 */
export type JobSyncStatus = {
  running: boolean;
  startedAt: number;
  finishedAt: number | null;
  /** Postings upserted so far this run. */
  found: number;
  /** Per-source outcome as each settles — the visible "browsing" progress. */
  sources: Array<{ id: string; count: number }>;
  /** sources finished / total. */
  done: number;
  total: number;
};

function statusKey(profile: RelevanceProfile, location?: LocationFilter): string {
  return `jobsync-status:${scopeFingerprint(profile, location)}`;
}

const STATUS_TTL_SECONDS = 10 * 60; // a run never legitimately outlives this

async function writeStatus(key: string, status: JobSyncStatus): Promise<void> {
  try {
    await getKv().set(key, JSON.stringify(status), STATUS_TTL_SECONDS);
  } catch {
    /* status is best-effort telemetry; never break the run over it */
  }
}

/** Read the current run status for the Jobs page. Null when no run is tracked. */
export async function getJobSyncStatus(
  profile: RelevanceProfile,
  location?: LocationFilter
): Promise<JobSyncStatus | null> {
  try {
    const raw = await getKv().get(statusKey(profile, location));
    return raw ? (JSON.parse(raw) as JobSyncStatus) : null;
  } catch {
    return null;
  }
}

/** A reserved run: the TTL window is claimed and the initial "running" status is written. */
type RunHandle = { key: string; sKey: string; status: JobSyncStatus };

/**
 * Claim the sync window and publish an initial "running" status. Returns null when a run
 * is already in flight for this profile+location (TTL window still open), so callers skip
 * a duplicate crawl. Awaiting this is cheap (a couple of KV ops) — the actual crawl is run
 * separately so it can be detached.
 */
async function beginRun(
  profile: RelevanceProfile,
  location?: LocationFilter
): Promise<RunHandle | null> {
  const kv = getKv();
  const key = await syncKey(profile, location);
  // Atomic single-winner claim: a plain get()+set() has a race window where two concurrent
  // loads both see "absent" and both fan out a full crawl. setNx closes it.
  const claimed = await kv.setNx(key, "1", SYNC_TTL_SECONDS);
  if (!claimed) return null;

  const sKey = statusKey(profile, location);
  const status: JobSyncStatus = {
    running: true,
    startedAt: Date.now(),
    finishedAt: null,
    found: 0,
    sources: [],
    done: 0,
    total: 0,
  };
  await writeStatus(sKey, status); // visible to the very next getJobSyncStatus read
  return { key, sKey, status };
}

/**
 * Kick off a deep background discovery run WITHOUT blocking the caller on the crawl. Awaits
 * only the fast window-claim + initial-status write (so the page's immediate status read
 * already shows "running"), then detaches the actual web crawl — which keeps browsing (browser
 * legs get a minute+) and persists results as it completes, updating the status record so the
 * page can show progress and auto-refresh. Safe on a long-lived self-host node where the
 * detached promise runs to completion after the response is sent.
 */
export async function startBackgroundSync(
  profile: RelevanceProfile,
  location?: LocationFilter
): Promise<void> {
  const run = await beginRun(profile, location);
  if (!run) return; // a crawl is already in flight for this profile+location
  void runDiscovery(profile, location, run).catch(() => {
    /* best-effort — the board still shows whatever is already stored */
  });
}

/**
 * Ensure the `jobs` table holds fresh live postings for this profile. Best
 * effort: any source failure is swallowed (we keep whatever is already stored)
 * so a flaky external API never breaks the dashboard. Returns how many postings
 * were upserted this call (0 when served from the TTL window).
 */
export async function ensureFreshLiveJobs(
  profile: RelevanceProfile,
  location?: LocationFilter
): Promise<number> {
  const run = await beginRun(profile, location);
  if (!run) return 0; // fresh window — a run is already in flight or recently done
  return runDiscovery(profile, location, run);
}

/**
 * The actual crawl + persist, given an already-claimed run. Split out from the window/status
 * bookkeeping so startBackgroundSync can detach THIS part while still having published the
 * initial "running" status synchronously. Returns how many postings were upserted.
 */
async function runDiscovery(
  profile: RelevanceProfile,
  location: LocationFilter | undefined,
  run: RunHandle
): Promise<number> {
  const kv = getKv();
  const { key, sKey, status } = run;

  try {
    // Deep pull. The cap is on POSTINGS to persist, not vacancies — since we now keep every
    // provider's posting (each becomes an occurrence), several postings can collapse to one
    // canonical job, so the cap is generous. The board's display limit is applied at read time.
    const postings = await discoverJobs(profile, 200, location, (ev) => {
      status.sources = [
        ...status.sources.filter((s) => s.id !== ev.id),
        { id: ev.id, count: ev.count },
      ];
      status.done = ev.done;
      status.total = ev.total;
      void writeStatus(sKey, status);
    });
    if (postings.length === 0) {
      // Nothing live came back — don't archive the seed, leave the user with
      // *something*. Shrink the window so we retry sooner than the full TTL.
      await kv.set(key, "1", 60);
      status.running = false;
      status.finishedAt = Date.now();
      await writeStatus(sKey, status);
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
      new Date(Date.now() - JOB_FRESHNESS_MS)
    );

    logger.info("jobs.sync.completed", {
      targetRole: profile.targetRole,
      discovered: postings.length,
      upserted,
      seedArchived: archived,
      staleExpired: expired,
    });

    status.running = false;
    status.finishedAt = Date.now();
    status.found = upserted;
    await writeStatus(sKey, status);

    return upserted;
  } catch (err) {
    logger.warn("jobs.sync.failed", {
      targetRole: profile.targetRole,
      error: err instanceof Error ? err.message : "unknown",
    });
    // A crashed run must NOT hold the 30-min lock — otherwise one transient failure blocks
    // every retry for half an hour. Shrink the window so the next load re-attempts soon.
    await kv.set(key, "1", 60).catch(() => {});
    status.running = false;
    status.finishedAt = Date.now();
    await writeStatus(sKey, status);
    return 0;
  }
}
