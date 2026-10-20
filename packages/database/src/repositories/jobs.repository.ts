import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";

import { canonicalizeUrl, canonicalJobKey } from "../canonical";
import type { Database } from "../client";
import { jobOccurrences, jobs, type Job, type JobOccurrence } from "../schema";

/** The base db or an open transaction — so shared helpers run inside a caller's transaction. */
type TxOrDb = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export type LivenessState = "live" | "closed" | "unknown";

export type SeedJobInput = {
  source: string;
  externalId: string;
  /** Owner of a PRIVATE capture (paste/extension/surf). Omit/null = a PUBLIC catalog row. */
  ownerUserId?: string | null;
  /** Cross-source dedupe identity. Computed from company+title+location when omitted. */
  canonicalKey?: string;
  title: string;
  company: string;
  location?: string | null;
  remoteMode?: string | null;
  employmentType?: string | null;
  seniority?: string | null;
  description?: string | null;
  url?: string | null;
  salaryText?: string | null;
  status?: string;
  postedAt?: Date | null;
  rawPayload?: Record<string, unknown>;
};

export function createJobsRepository(db: Database) {
  /**
   * Recompute a canonical job's rolled-up fields from its occurrences and persist them, so every
   * reader keeps seeing a single well-merged vacancy. Status rules, strongest signal first:
   *  - a private MANUAL paste stays "manual" (workspace-only, off the board);
   *  - a liveness-confirmed "closed" wins (a human/page said so) — cleared on a later live probe;
   *  - otherwise ACTIVE while ANY occurrence is active (one closed listing can't close the
   *    vacancy, and a re-list reopens it), else closed, else expired.
   * Description = the fullest occurrence; url = that occurrence's link; postedAt = the freshest.
   *
   * Runs on the passed executor (a transaction) and takes a FOR UPDATE row lock on the canonical
   * job first, so concurrent ingestions of the same vacancy serialize instead of reading stale
   * snapshots and clobbering each other's aggregate.
   */
  const reaggregate = async (exec: TxOrDb, jobId: string): Promise<Job | null> => {
    const [current] = await exec
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1)
      .for("update");
    if (!current) return null;
    const occ = await exec.select().from(jobOccurrences).where(eq(jobOccurrences.jobId, jobId));
    if (occ.length === 0) return current;

    const byFullest = [...occ].sort(
      (a, b) => (b.description?.length ?? 0) - (a.description?.length ?? 0)
    );
    const description = byFullest[0]?.description ?? current.description;
    const url = byFullest.find((o) => o.url)?.url ?? current.url;
    const postedAt =
      occ
        .map((o) => o.postedAt)
        .filter((d): d is Date => d != null)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? current.postedAt;

    const isManualPaste = current.ownerUserId != null && current.source === "manual";
    let status: string;
    if (isManualPaste)
      status = current.status; // keep "manual"
    else if (current.livenessState === "closed") status = "closed";
    else if (occ.some((o) => o.status === "active")) status = "active";
    else if (occ.some((o) => o.status === "closed")) status = "closed";
    else status = "expired";

    const [updated] = await exec
      .update(jobs)
      .set({ description, url, postedAt, status, updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
      .returning();
    return updated ?? current;
  };

  return {
    async listActive(): Promise<Job[]> {
      return db
        .select()
        .from(jobs)
        .where(eq(jobs.status, "active"))
        .orderBy(asc(jobs.company), asc(jobs.title));
    },

    /**
     * Active jobs visible to a user: the whole PUBLIC catalog (owner null) plus THEIR OWN private
     * captures — never anyone else's. When the same vacancy exists both publicly and as this
     * user's private capture, the private row wins (their edits/notes), so the board shows it once.
     */
    async listActiveForUser(userId: string): Promise<Job[]> {
      const rows = await db
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.status, "active"),
            sql`(${jobs.ownerUserId} is null or ${jobs.ownerUserId} = ${userId})`
          )
        )
        .orderBy(asc(jobs.company), asc(jobs.title));

      const byKey = new Map<string, Job>();
      for (const row of rows) {
        const existing = byKey.get(row.canonicalKey);
        if (!existing || (row.ownerUserId === userId && existing.ownerUserId == null)) {
          byKey.set(row.canonicalKey, row);
        }
      }
      return [...byKey.values()];
    },

    async findById(id: string): Promise<Job | null> {
      const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
      return job ?? null;
    },

    /**
     * Find a job a user is allowed to see: a public row, or one they privately own. Returns null
     * for another user's private capture — the ownership gate for workspace / save / apply reads.
     */
    async findByIdForUser(userId: string, id: string): Promise<Job | null> {
      const [job] = await db
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.id, id),
            sql`(${jobs.ownerUserId} is null or ${jobs.ownerUserId} = ${userId})`
          )
        )
        .limit(1);
      return job ?? null;
    },

    /** Any status — lets callers check whether saved/applied jobs went stale. */
    async listByIds(ids: string[]): Promise<Job[]> {
      if (ids.length === 0) return [];
      return db.select().from(jobs).where(inArray(jobs.id, ids));
    },

    /**
     * Archive every job from a given source (e.g. retire the local MVP seed
     * once real live postings are flowing). Archived rows drop out of
     * `listActive` but stay referencable by saved/applied records.
     */
    async deactivateBySource(source: string): Promise<number> {
      const updated = await db
        .update(jobs)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(jobs.source, source))
        .returning({ id: jobs.id });
      return updated.length;
    },

    /**
     * Age out stale live postings. `updatedAt` is bumped every time a posting
     * reappears in a sync (see `upsertSeedJob`), so a row whose `updatedAt` is
     * older than `staleBefore` hasn't been re-seen on the boards in a while —
     * strong signal it's been pulled. We mark those `expired` so they drop out
     * of `listActive` and never waste a user's time. Optionally scope to a
     * single source (e.g. only age out a specific board's rows).
     */
    async archiveStaleLiveJobs(staleBefore: Date, source?: string): Promise<number> {
      // PUBLIC rows only: a private capture's freshness is the user's business, not the crawl's —
      // it must not expire just because the systematic sync stopped re-seeing it.
      const conditions = [
        eq(jobs.status, "active"),
        lt(jobs.updatedAt, staleBefore),
        sql`${jobs.ownerUserId} is null`,
      ];
      if (source) conditions.push(eq(jobs.source, source));

      const updated = await db
        .update(jobs)
        .set({ status: "expired", updatedAt: new Date() })
        .where(and(...conditions))
        .returning({ id: jobs.id });
      return updated.length;
    },

    /** Store a job's semantic vector (hybrid search). Best-effort, additive. */
    async setEmbedding(id: string, embedding: number[], model: string): Promise<void> {
      await db
        .update(jobs)
        .set({ embedding, embeddingModel: model, updatedAt: new Date() })
        .where(eq(jobs.id, id));
    },

    /**
     * Record a posting-liveness probe result. "closed" also flips status to
     * "closed" so the role drops out of `listActive` immediately and STAYS out
     * across re-syncs (a job can be closed on the employer site yet linger in an
     * aggregator feed). "live"/"unknown" only stamp the cache so we don't re-probe.
     */
    async setJobLiveness(id: string, state: LivenessState): Promise<void> {
      // Liveness is authoritative on the CANONICAL row. reaggregate() then rolls it into status:
      // a confirmed "closed" closes the vacancy; a later "live" re-check clears it and the vacancy
      // reopens if any occurrence is still active — so "closed" is no longer sticky forever.
      await db.transaction(async (tx) => {
        await tx
          .update(jobs)
          .set({ livenessState: state, livenessCheckedAt: new Date(), updatedAt: new Date() })
          .where(eq(jobs.id, id));
        await reaggregate(tx, id);
      });
    },

    /** Every provider's occurrence of a vacancy — provenance for the workspace. */
    async listOccurrencesForJob(jobId: string): Promise<JobOccurrence[]> {
      return db
        .select()
        .from(jobOccurrences)
        .where(eq(jobOccurrences.jobId, jobId))
        .orderBy(asc(jobOccurrences.source));
    },

    async upsertSeedJob(input: SeedJobInput): Promise<Job> {
      const ownerUserId = input.ownerUserId ?? null;
      const canonicalKey =
        input.canonicalKey ?? canonicalJobKey(input.company, input.title, input.location);
      const url = canonicalizeUrl(input.url) ?? null;

      // Dedupe within the correct SCOPE: a public write conflicts only with other public rows
      // (the partial unique WHERE owner is null); a private write conflicts only within the same
      // owner. This is what stops a paste from mutating the global catalog, or a crawl from
      // touching someone's private capture.
      const set = {
        // Longest description wins (Jooble's ~270-char teaser must not clobber a full JD).
        description: sql`CASE WHEN length(coalesce(excluded.description, '')) > length(coalesce(${jobs.description}, '')) THEN excluded.description ELSE ${jobs.description} END`,
        // Fill gaps only — keep the first good value, never overwrite with null.
        location: sql`coalesce(${jobs.location}, excluded.location)`,
        remoteMode: sql`coalesce(${jobs.remoteMode}, excluded.remote_mode)`,
        employmentType: sql`coalesce(${jobs.employmentType}, excluded.employment_type)`,
        seniority: sql`coalesce(${jobs.seniority}, excluded.seniority)`,
        salaryText: sql`coalesce(${jobs.salaryText}, excluded.salary_text)`,
        url: sql`coalesce(${jobs.url}, excluded.url)`,
        // Freshest confirmed posting date (GREATEST ignores NULLs in Postgres).
        postedAt: sql`GREATEST(${jobs.postedAt}, excluded.posted_at)`,
        // Never resurrect a liveness-confirmed "closed" role when re-listed.
        status: sql`CASE WHEN ${jobs.status} = 'closed' THEN 'closed' ELSE excluded.status END`,
        updatedAt: new Date(),
      };
      const conflict =
        ownerUserId === null
          ? { target: jobs.canonicalKey, targetWhere: sql`${jobs.ownerUserId} is null`, set }
          : {
              target: [jobs.ownerUserId, jobs.canonicalKey],
              targetWhere: sql`${jobs.ownerUserId} is not null`,
              set,
            };

      // ATOMIC: canonical upsert + occurrence upsert + reaggregate run in ONE transaction, so a
      // failure can never leave a canonical job without its occurrence, and the FOR UPDATE lock in
      // reaggregate serializes concurrent ingestions of the same vacancy.
      return db.transaction(async (tx) => {
        const [job] = await tx
          .insert(jobs)
          .values({
            source: input.source,
            externalId: input.externalId,
            ownerUserId,
            canonicalKey,
            title: input.title,
            company: input.company,
            location: input.location ?? null,
            remoteMode: input.remoteMode ?? null,
            employmentType: input.employmentType ?? null,
            seniority: input.seniority ?? null,
            description: input.description ?? null,
            url,
            salaryText: input.salaryText ?? null,
            status: input.status ?? "active",
            postedAt: input.postedAt ?? null,
            rawPayload: input.rawPayload ?? {},
          })
          // Dedupe on the CANONICAL vacancy identity (scoped above), not (source, externalId): one
          // row per real job even when several providers surface it. On conflict we FIELD-QUALITY
          // MERGE — a later teaser or a null must never downgrade an existing description/metadata.
          .onConflictDoUpdate(conflict)
          .returning();

        // Record THIS provider's occurrence (provenance + per-source truth), then re-derive the
        // canonical row's rolled-up fields from ALL occurrences so readers stay unchanged.
        await tx
          .insert(jobOccurrences)
          .values({
            jobId: job.id,
            source: input.source,
            externalId: input.externalId,
            url,
            description: input.description ?? null,
            postedAt: input.postedAt ?? null,
            status: input.status ?? "active",
            lastSeenAt: new Date(),
            rawPayload: input.rawPayload ?? {},
          })
          .onConflictDoUpdate({
            target: [jobOccurrences.jobId, jobOccurrences.source, jobOccurrences.externalId],
            set: {
              url: sql`coalesce(excluded.url, ${jobOccurrences.url})`,
              description: sql`CASE WHEN length(coalesce(excluded.description, '')) > length(coalesce(${jobOccurrences.description}, '')) THEN excluded.description ELSE ${jobOccurrences.description} END`,
              postedAt: sql`GREATEST(${jobOccurrences.postedAt}, excluded.posted_at)`,
              // A re-list is evidence this source's occurrence is open again.
              status: sql`excluded.status`,
              lastSeenAt: new Date(),
              updatedAt: new Date(),
            },
          });

        return (await reaggregate(tx, job.id)) ?? job;
      });
    },
  };
}
