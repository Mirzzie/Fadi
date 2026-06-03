import { asc, eq } from "drizzle-orm";

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
