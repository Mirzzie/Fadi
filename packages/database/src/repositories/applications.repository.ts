import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "../client";
import { applications, type Application } from "../schema";

export type ApplicationStatus =
  | "interested"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "withdrawn";

export type UpsertApplicationStatusInput = {
  jobId: string;
  company: string;
  title: string;
  url?: string | null;
  status: ApplicationStatus;
};

export function createApplicationsRepository(db: Database) {
  return {
    async listForUserByJobIds(userId: string, jobIds: string[]): Promise<Application[]> {
      if (jobIds.length === 0) {
        return [];
      }

      return db
        .select()
        .from(applications)
        .where(and(eq(applications.userId, userId), inArray(applications.jobId, jobIds)));
    },

    async upsertStatusForUser(
      userId: string,
      input: UpsertApplicationStatusInput
    ): Promise<Application> {
      const [existing] = await db
        .select()
        .from(applications)
        .where(and(eq(applications.userId, userId), eq(applications.jobId, input.jobId)))
        .limit(1);

      if (existing) {
        const [application] = await db
          .update(applications)
          .set({
            company: input.company,
            title: input.title,
            url: input.url ?? null,
            status: input.status,
            appliedAt:
              input.status === "applied" && !existing.appliedAt ? new Date() : existing.appliedAt,
            updatedAt: new Date(),
          })
          .where(eq(applications.id, existing.id))
          .returning();

        return application;
      }

      const [application] = await db
        .insert(applications)
        .values({
          userId,
          jobId: input.jobId,
          company: input.company,
          title: input.title,
          url: input.url ?? null,
          status: input.status,
          appliedAt: input.status === "applied" ? new Date() : null,
        })
        .returning();

      return application;
    },
  };
}
