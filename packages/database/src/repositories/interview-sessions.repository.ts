import { and, desc, eq, isNull, or } from "drizzle-orm";

import type { DbOrTx } from "../client";
import {
  applications,
  careerProfiles,
  interviewSessions,
  jobs,
  type InterviewSession,
} from "../schema";

export const INTERVIEW_SESSION_STAGES = [
  "recruiter",
  "hiring_manager",
  "technical",
  "behavioral",
] as const;
export type InterviewSessionStage = (typeof INTERVIEW_SESSION_STAGES)[number];

export const INTERVIEW_SESSION_STATUSES = ["active", "completed", "abandoned", "failed"] as const;
export type InterviewSessionStatus = (typeof INTERVIEW_SESSION_STATUSES)[number];

export type CreateInterviewSessionInput = {
  applicationId?: string | null;
  jobId?: string | null;
  careerProfileId?: string | null;
  role: string;
  company?: string | null;
  stage: InterviewSessionStage;
  durationMinutes: 10 | 20;
  mode?: "turn_based" | "realtime";
  questions: Record<string, unknown>[];
};

/** Durable identity and lifecycle for a practice session; transcripts remain opt-in elsewhere. */
export function createInterviewSessionsRepository(db: DbOrTx) {
  async function getForUser(userId: string, id: string): Promise<InterviewSession | null> {
    const [row] = await db
      .select()
      .from(interviewSessions)
      .where(and(eq(interviewSessions.userId, userId), eq(interviewSessions.id, id)))
      .limit(1);
    return row ?? null;
  }

  return {
    async createForUser(
      userId: string,
      input: CreateInterviewSessionInput
    ): Promise<InterviewSession> {
      const role = input.role.trim();
      if (!role) throw new Error("An interview session needs a role.");

      let applicationJobId: string | null = null;
      if (input.applicationId) {
        const [owned] = await db
          .select({ jobId: applications.jobId })
          .from(applications)
          .where(and(eq(applications.userId, userId), eq(applications.id, input.applicationId)))
          .limit(1);
        if (!owned) throw new Error("Application unavailable.");
        applicationJobId = owned.jobId;
        if (input.jobId && applicationJobId && input.jobId !== applicationJobId) {
          throw new Error("The interview job does not match the application.");
        }
      }

      const jobId = input.jobId ?? applicationJobId;
      if (jobId) {
        const [visible] = await db
          .select({ id: jobs.id })
          .from(jobs)
          .where(
            and(eq(jobs.id, jobId), or(isNull(jobs.ownerUserId), eq(jobs.ownerUserId, userId)))
          )
          .limit(1);
        if (!visible) throw new Error("Job unavailable.");
      }
      if (input.careerProfileId) {
        const [owned] = await db
          .select({ id: careerProfiles.id })
          .from(careerProfiles)
          .where(
            and(eq(careerProfiles.userId, userId), eq(careerProfiles.id, input.careerProfileId))
          )
          .limit(1);
        if (!owned) throw new Error("Career direction unavailable.");
      }

      const [row] = await db
        .insert(interviewSessions)
        .values({
          userId,
          applicationId: input.applicationId ?? null,
          jobId,
          careerProfileId: input.careerProfileId ?? null,
          role,
          company: input.company?.trim() || null,
          stage: input.stage,
          durationMinutes: input.durationMinutes,
          mode: input.mode ?? "turn_based",
          status: "active",
          questions: input.questions,
        })
        .returning();
      return row;
    },

    getForUser,

    async listForUser(userId: string, limit = 20): Promise<InterviewSession[]> {
      return db
        .select()
        .from(interviewSessions)
        .where(eq(interviewSessions.userId, userId))
        .orderBy(desc(interviewSessions.startedAt))
        .limit(limit);
    },

    async finishForUser(
      userId: string,
      id: string,
      status: Exclude<InterviewSessionStatus, "active">
    ): Promise<InterviewSession | null> {
      const [row] = await db
        .update(interviewSessions)
        .set({ status, completedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(interviewSessions.userId, userId),
            eq(interviewSessions.id, id),
            eq(interviewSessions.status, "active")
          )
        )
        .returning();
      if (row) return row;
      const existing = await getForUser(userId, id);
      return existing?.status === status ? existing : null;
    },
  };
}
