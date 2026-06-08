import { and, asc, eq, lt } from "drizzle-orm";

import type { Database } from "../client";
import { jobs, type Job } from "../schema";

export type SeedJobInput = {
  source: string;
  externalId: string;
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
  return {
    async listActive(): Promise<Job[]> {
      return db
        .select()
        .from(jobs)
        .where(eq(jobs.status, "active"))
        .orderBy(asc(jobs.company), asc(jobs.title));
    },

    async findById(id: string): Promise<Job | null> {
      const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
      return job ?? null;
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
      const conditions = [
        eq(jobs.status, "active"),
        lt(jobs.updatedAt, staleBefore),
      ];
      if (source) conditions.push(eq(jobs.source, source));

      const updated = await db
        .update(jobs)
        .set({ status: "expired", updatedAt: new Date() })
        .where(and(...conditions))
        .returning({ id: jobs.id });
      return updated.length;
    },

    async upsertSeedJob(input: SeedJobInput): Promise<Job> {
      const [job] = await db
        .insert(jobs)
        .values({
          source: input.source,
          externalId: input.externalId,
          title: input.title,
          company: input.company,
          location: input.location ?? null,
          remoteMode: input.remoteMode ?? null,
          employmentType: input.employmentType ?? null,
          seniority: input.seniority ?? null,
          description: input.description ?? null,
          url: input.url ?? null,
          salaryText: input.salaryText ?? null,
          status: input.status ?? "active",
          postedAt: input.postedAt ?? null,
          rawPayload: input.rawPayload ?? {},
        })
        .onConflictDoUpdate({
          target: [jobs.source, jobs.externalId],
          set: {
            title: input.title,
            company: input.company,
            location: input.location ?? null,
            remoteMode: input.remoteMode ?? null,
            employmentType: input.employmentType ?? null,
            seniority: input.seniority ?? null,
            description: input.description ?? null,
            url: input.url ?? null,
            salaryText: input.salaryText ?? null,
            status: input.status ?? "active",
            postedAt: input.postedAt ?? null,
            rawPayload: input.rawPayload ?? {},
            updatedAt: new Date(),
          },
        })
        .returning();

      return job;
    },
  };
}
