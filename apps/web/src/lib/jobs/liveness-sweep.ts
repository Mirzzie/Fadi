import type { LivenessState, PostingLiveness } from "./liveness-detect";

/**
 * Bounded posting-liveness sweep for the jobs we're about to SHOW. Probes only
 * postings we haven't checked recently (DB-cached via livenessCheckedAt), persists
 * each result, and returns the ids confirmed closed so the caller can drop them —
 * so nobody tailors a CV for a role that already says "no longer accepting
 * applications". IO is injected (check/persist) to keep the orchestration testable.
 */

export interface SweepableJob {
  id: string;
  url: string | null;
  livenessCheckedAt: Date | string | null;
}

export interface LivenessSweepDeps {
  check: (url: string) => Promise<PostingLiveness>;
  persist: (jobId: string, state: LivenessState) => Promise<void>;
}

export interface SweepOptions {
  now?: number;
  /** Don't re-probe a posting checked within this window. */
  ttlMs?: number;
  /** Cap probes per sweep so a render never fans out unbounded. */
  maxProbes?: number;
  /** Stop launching new probes past this wall-clock budget. */
  budgetMs?: number;
  concurrency?: number;
}

const TWELVE_HOURS = 12 * 60 * 60 * 1000;

/** Pure: does this posting need a (re)probe? Needs a URL and a stale/empty cache. */
export function needsLivenessProbe(job: SweepableJob, now: number, ttlMs: number): boolean {
  if (!job.url) return false;
  if (!job.livenessCheckedAt) return true;
  const checked = new Date(job.livenessCheckedAt).getTime();
  if (!Number.isFinite(checked)) return true;
  return now - checked >= ttlMs;
}

export async function sweepJobsLiveness(
  jobs: SweepableJob[],
  deps: LivenessSweepDeps,
  opts: SweepOptions = {},
): Promise<Set<string>> {
  // `now` (injectable) drives only the freshness decision; the budget runs on the
  // real wall clock so a back-dated `now` in tests can't disable the loop.
  const now = opts.now ?? Date.now();
  const ttlMs = opts.ttlMs ?? TWELVE_HOURS;
  const maxProbes = opts.maxProbes ?? 6;
  const budgetMs = opts.budgetMs ?? 5000;
  const concurrency = opts.concurrency ?? 6;
  const deadline = Date.now() + budgetMs;

  const queue = jobs.filter((j) => needsLivenessProbe(j, now, ttlMs)).slice(0, maxProbes);
  const closed = new Set<string>();
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < queue.length && Date.now() < deadline) {
      const job = queue[cursor++];
      if (!job.url) continue;
      try {
        const result = await deps.check(job.url);
        await deps.persist(job.id, result.state);
        if (result.state === "closed") closed.add(job.id);
      } catch {
        // Best-effort — leave it uncached so the next sweep retries.
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker());
  await Promise.all(workers);
  return closed;
}
