import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";

import type { Database } from "../client";
import { applications, type Application } from "../schema";
import type { TrackScope } from "./saved-jobs.repository";

/**
 * Track filter for the application pipeline. NULL career_profile_id = created
 * before the pipeline was track-aware; those stay visible in every track so a
 * migration never hides someone's live applications.
 */
function trackFilter(scope: TrackScope) {
  if (scope.scope === "all") return undefined;
  return scope.careerProfileId
    ? or(
        eq(applications.careerProfileId, scope.careerProfileId),
        isNull(applications.careerProfileId),
      )
    : isNull(applications.careerProfileId);
}

export type ApplicationStatus =
  | "interested"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "withdrawn";

export type UpsertApplicationStatusInput = {
  jobId: string;
  /** The direction the user was in when they engaged this job. */
  careerProfileId?: string | null;
  company: string;
  title: string;
  url?: string | null;
  status: ApplicationStatus;
};

export type CreateApplicationInput = {
  jobId?: string | null;
  /** The direction this application belongs to (the user's active track). */
  careerProfileId?: string | null;
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
    /** Defaults to "all" so existing callers keep their current behaviour. */
    async listForUser(userId: string, scope: TrackScope = { scope: "all" }): Promise<Application[]> {
      return db
        .select()
        .from(applications)
        .where(and(eq(applications.userId, userId), trackFilter(scope)))
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
          careerProfileId: input.careerProfileId ?? null,
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
          careerProfileId: input.careerProfileId ?? null,
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
