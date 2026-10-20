import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "../client";
import { labObservations, type LabObservation } from "../schema/index";

export type LabObservationInput = {
  subject: string;
  predicateId: string;
  predicateVersion: number;
  paramsKey: string;
  verdict: "pass" | "fail" | "unknown";
  evidence: Record<string, unknown>;
  observerVersion: string;
};

/** The latest observation per subject and predicate (guided labs, G-1). Owner-scoped. */
export function createLabObservationsRepository(db: Database) {
  return {
    /** The latest observations for these subjects. */
    async forSubjects(userId: string, subjects: string[]): Promise<LabObservation[]> {
      if (subjects.length === 0) return [];
      return db
        .select()
        .from(labObservations)
        .where(and(eq(labObservations.userId, userId), inArray(labObservations.subject, subjects)));
    },

    /** Record an observation, replacing the earlier one for the same subject and predicate. */
    async record(userId: string, input: LabObservationInput): Promise<LabObservation> {
      const observedAt = new Date();
      const [row] = await db
        .insert(labObservations)
        .values({ userId, ...input, observedAt })
        .onConflictDoUpdate({
          target: [
            labObservations.userId,
            labObservations.subject,
            labObservations.predicateId,
            labObservations.paramsKey,
          ],
          set: {
            predicateVersion: input.predicateVersion,
            verdict: input.verdict,
            evidence: input.evidence,
            observerVersion: input.observerVersion,
            observedAt,
          },
        })
        .returning();
      return row!;
    },

    /** Forget a subject's observations (a project's fresh start). */
    async clearSubject(userId: string, subject: string): Promise<void> {
      await db
        .delete(labObservations)
        .where(and(eq(labObservations.userId, userId), eq(labObservations.subject, subject)));
    },
  };
}
