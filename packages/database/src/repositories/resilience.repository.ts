import { and, count, desc, eq, gte, isNotNull } from "drizzle-orm";

import type { Database } from "../client";
import {
  applications,
  momentumStates,
  resilienceEvents,
  type Application,
  type MomentumState,
  type NewResilienceEvent,
  type ResilienceEvent,
} from "../schema";

export function createResilienceRepository(db: Database) {
  return {
    /** Fetch the user's momentum row, or null if they have none yet. */
    async getMomentumState(userId: string): Promise<MomentumState | null> {
      const [state] = await db
        .select()
        .from(momentumStates)
        .where(eq(momentumStates.userId, userId))
        .limit(1);

      return state ?? null;
    },

    /** Create an empty momentum row for a user (idempotent via unique index). */
    async ensureMomentumState(userId: string): Promise<MomentumState> {
      const existing = await this.getMomentumState(userId);
      if (existing) return existing;

      const [created] = await db
        .insert(momentumStates)
        .values({ userId })
        .onConflictDoNothing({ target: momentumStates.userId })
        .returning();

      // If a concurrent insert won the race, re-read.
      return created ?? (await this.getMomentumState(userId))!;
    },

    /** Persist a recomputed momentum snapshot. */
    async updateMomentumState(
      userId: string,
      patch: Partial<
        Pick<
          MomentumState,
          | "momentum"
          | "peakMomentum"
          | "lastActionAt"
          | "cadenceTarget"
          | "cadencePeriod"
          | "restingUntil"
        >
      >,
    ): Promise<MomentumState> {
      const [updated] = await db
        .update(momentumStates)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(momentumStates.userId, userId))
        .returning();

      return updated;
    },

    /** Append a forward-motion event to the ledger. */
    async recordEvent(event: NewResilienceEvent): Promise<ResilienceEvent> {
      const [created] = await db.insert(resilienceEvents).values(event).returning();
      return created;
    },

    /** Recent ledger entries for history / pattern surfacing. */
    async listRecentEvents(userId: string, limit = 20): Promise<ResilienceEvent[]> {
      return db
        .select()
        .from(resilienceEvents)
        .where(eq(resilienceEvents.userId, userId))
        .orderBy(desc(resilienceEvents.createdAt))
        .limit(limit);
    },

    /** Count events of a given kind since a cutoff (e.g. quality apps this week). */
    async countEventsSince(userId: string, kind: string, since: Date): Promise<number> {
      const [row] = await db
        .select({ value: count() })
        .from(resilienceEvents)
        .where(
          and(
            eq(resilienceEvents.userId, userId),
            eq(resilienceEvents.kind, kind),
            gte(resilienceEvents.createdAt, since),
          ),
        );

      return row?.value ?? 0;
    },

    // ── Provenance helpers (anti-fake-rejection) ───────────────────────────────

    /** Load an application the user owns — used to verify a rejection is real. */
    async getApplicationForUser(userId: string, applicationId: string): Promise<Application | null> {
      const [application] = await db
        .select()
        .from(applications)
        .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
        .limit(1);

      return application ?? null;
    },

    /** Record an outcome on an application (the honest record — never the reward). */
    async setApplicationOutcome(
      applicationId: string,
      patch: {
        outcome: string;
        outcomeAt?: Date;
        rejectionStage?: string | null;
        rejectionVerified?: boolean;
        status?: string;
      },
    ): Promise<Application> {
      const [updated] = await db
        .update(applications)
        .set({
          outcome: patch.outcome,
          outcomeAt: patch.outcomeAt ?? new Date(),
          rejectionStage: patch.rejectionStage ?? null,
          rejectionVerified: patch.rejectionVerified ?? false,
          ...(patch.status ? { status: patch.status } : {}),
          updatedAt: new Date(),
        })
        .where(eq(applications.id, applicationId))
        .returning();

      return updated;
    },

    /** Count applications the user has actually sent (appliedAt set) — for anomaly checks. */
    async countSentApplications(userId: string): Promise<number> {
      const [row] = await db
        .select({ value: count() })
        .from(applications)
        .where(and(eq(applications.userId, userId), isNotNull(applications.appliedAt)));

      return row?.value ?? 0;
    },
  };
}
