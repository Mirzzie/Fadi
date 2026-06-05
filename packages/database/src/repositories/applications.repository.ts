import { and, desc, eq, inArray } from "drizzle-orm";

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

export type CreateApplicationInput = {
  jobId?: string | null;
  company: string;
  title: string;
  url?: string | null;
  jobDescription?: string | null;
  status?: ApplicationStatus;
  notes?: string | null;
};

export type UpdateApplicationInput = Partial<{
  company: string;
  title: string;
  url: string | null;
  jobDescription: string | null;
  status: ApplicationStatus;
  notes: string | null;
  deadlineAt: Date | null;
  appliedAt: Date | null;
}>;

export function createApplicationsRepository(db: Database) {
  return {
    async listForUser(userId: string): Promise<Application[]> {
      return db
        .select()
        .from(applications)
        .where(eq(applications.userId, userId))
        .orderBy(desc(applications.updatedAt));
    },

    async getForUser(userId: string, id: string): Promise<Application | null> {
      const [app] = await db
        .select()
        .from(applications)
        .where(and(eq(applications.userId, userId), eq(applications.id, id)))
        .limit(1);
      return app ?? null;
    },

    async createForUser(userId: string, input: CreateApplicationInput): Promise<Application> {
      const status = input.status ?? "interested";
      const [app] = await db
        .insert(applications)
        .values({
          userId,
          jobId: input.jobId ?? null,
          company: input.company,
          title: input.title,
          url: input.url ?? null,
          jobDescription: input.jobDescription ?? null,
          status,
          notes: input.notes ?? null,
          appliedAt: status === "applied" ? new Date() : null,
        })
        .returning();
      return app;
    },

    async updateForUser(
      userId: string,
      id: string,
      input: UpdateApplicationInput
    ): Promise<Application | null> {
      const set: Record<string, unknown> = { ...input, updatedAt: new Date() };
      // Stamp appliedAt the first time a row moves to "applied".
      if (input.status === "applied") {
        const existing = await db
          .select()
          .from(applications)
          .where(and(eq(applications.userId, userId), eq(applications.id, id)))
          .limit(1);
        if (existing[0] && !existing[0].appliedAt) set.appliedAt = new Date();
      }
      const [app] = await db
        .update(applications)
        .set(set)
        .where(and(eq(applications.userId, userId), eq(applications.id, id)))
        .returning();
      return app ?? null;
    },

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
