import { and, count, desc, eq } from "drizzle-orm";

import type { Database } from "../client";
import { referralTargets, type NewReferralTarget, type ReferralTarget } from "../schema";

/**
 * Referral targets — the people / warm-intro paths a user is pursuing. The
 * Resilience Engine rewards the controllable ASK; this repo just stores the funnel
 * (identified → asked → responded → referred / declined) and the drafted outreach.
 */
export function createReferralsRepository(db: Database) {
  return {
    async listForUser(userId: string, limit = 100): Promise<ReferralTarget[]> {
      return db
        .select()
        .from(referralTargets)
        .where(eq(referralTargets.userId, userId))
        .orderBy(desc(referralTargets.updatedAt))
        .limit(limit);
    },

    async getForUser(userId: string, id: string): Promise<ReferralTarget | null> {
      const [row] = await db
        .select()
        .from(referralTargets)
        .where(and(eq(referralTargets.id, id), eq(referralTargets.userId, userId)))
        .limit(1);
      return row ?? null;
    },

    async create(
      userId: string,
      input: Omit<NewReferralTarget, "id" | "userId" | "createdAt" | "updatedAt">,
    ): Promise<ReferralTarget> {
      const [created] = await db
        .insert(referralTargets)
        .values({ ...input, userId })
        .returning();
      return created;
    },

    /** Patch a target the user owns. Returns null if it isn't theirs. */
    async update(
      userId: string,
      id: string,
      patch: Partial<
        Pick<
          ReferralTarget,
          "company" | "roleTitle" | "contactName" | "contactRole" | "relationship" | "channel" | "status" | "outreachDraft" | "notes" | "askedAt"
        >
      >,
    ): Promise<ReferralTarget | null> {
      const [updated] = await db
        .update(referralTargets)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(referralTargets.id, id), eq(referralTargets.userId, userId)))
        .returning();
      return updated ?? null;
    },

    async delete(userId: string, id: string): Promise<void> {
      await db
        .delete(referralTargets)
        .where(and(eq(referralTargets.id, id), eq(referralTargets.userId, userId)));
    },

    /** How many referral asks the user has actually made (status past "identified"). */
    async countAsked(userId: string): Promise<number> {
      const [row] = await db
        .select({ value: count() })
        .from(referralTargets)
        .where(and(eq(referralTargets.userId, userId), eq(referralTargets.status, "asked")));
      return row?.value ?? 0;
    },
  };
}
