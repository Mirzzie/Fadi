import { and, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "../client";
import {
  authIdentities,
  user as betterAuthUser,
  productEvents,
  users,
  type User,
} from "../schema/index";

export type AuthProvider = "supabase" | "better_auth" | "authjs" | "custom";

export type ExternalAuthIdentityInput = {
  provider: AuthProvider;
  providerSubject: string;
  email: string;
  emailVerifiedAt?: Date | null;
  fullName?: string | null;
  providerProfile?: Record<string, unknown>;
};

export function createUsersRepository(db: Database) {
  return {
    async findById(id: string): Promise<User | null> {
      const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return user ?? null;
    },

    /**
     * "Delete my data" — erase all career data, KEEP the login.
     *
     * Deletes the domain `users` row; 26 FK cascades from `users.id` remove every piece
     * of career data (résumés, evidence, applications, rejection autopsies, portfolio…).
     * The better-auth identity is intentionally left intact, so the same credentials can
     * start a fresh, empty account. This is the "start over" path, distinct from account
     * closure below. See docs/adr/0007-data-retention-and-erasure.md.
     */
    /**
     * "Delete my data" — erase career data, keep the login.
     *
     * D07: `product_events` is the ONE table that does not cascade — it is
     * `ON DELETE SET NULL`, so its rows survive the user with `user_id` emptied. That is
     * defensible for anonymous product counts and indefensible for what the payloads
     * actually hold: which pieces of work were opened, the visitor's city, country and
     * NETWORK ORGANISATION, and — for feedback events — the message someone wrote and
     * the email address they left.
     *
     * So a person deleting their data orphaned a THIRD PARTY's message and contact
     * details into a row nobody owns and no deletion request can ever reach again.
     *
     * The payload is redacted before the user goes. The event type and its timestamp
     * remain, which is all an aggregate count needs; everything identifying does not.
     * One transaction, because a redaction that half-applies is worse than none — the
     * caller would report success over rows still holding the content.
     */
    async deleteById(id: string): Promise<void> {
      await db.transaction(async (tx) => {
        await tx
          .update(productEvents)
          .set({ payload: {} })
          .where(eq(productEvents.userId, id));
        await tx.delete(users).where(eq(users.id, id));
      });
    },

    /**
     * "Close my account" — full erasure of career data AND the login credentials, in ONE
     * transaction. This is what GDPR Art. 17 erasure means, and what `deleteById` alone
     * did not do: it left the better-auth `user` row (and its cascading `session` /
     * `account`) behind, so the credentials still authenticated afterwards.
     *
     * There are two identity tables — the app `users` (uuid) and better-auth `user`
     * (text) — with NO foreign key between them. They are linked only through
     * `auth_identities`, where a `better_auth` row's `provider_subject` holds the
     * better-auth `user.id`. So closure is: look up the linked better-auth id(s), then
     * delete BOTH identity rows atomically.
     *
     * MUST be one transaction. Deleting the two identities as separate statements is the
     * exact non-atomic pattern fixed in learning/actions.ts and portfolio.repository.ts:
     * a failure between them would leave an account that is half-erased and still logs
     * in — strictly worse than doing nothing, because the user believes they are gone.
     *
     * Returns the better-auth ids removed, for logging/verification by the caller.
     */
    async closeAccount(id: string): Promise<{ betterAuthIds: string[] }> {
      return db.transaction(async (tx) => {
        // Resolve the linked better-auth identity BEFORE deleting the app user, because
        // deleting `users` cascades `auth_identities` away and the link with it.
        const identities = await tx
          .select({ subject: authIdentities.providerSubject })
          .from(authIdentities)
          .where(and(eq(authIdentities.userId, id), eq(authIdentities.provider, "better_auth")));
        const betterAuthIds = identities.map((r) => r.subject);

        // D07 again, and it matters more here: closure is full erasure, so leaving
        // orphaned payloads behind would contradict the promise outright.
        await tx.update(productEvents).set({ payload: {} }).where(eq(productEvents.userId, id));

        // App side: cascades 26 career-data tables (incl. auth_identities).
        await tx.delete(users).where(eq(users.id, id));

        // Auth side: cascades session + account. Guarded — a user with no better-auth
        // identity (e.g. a legacy Supabase row) simply has nothing to delete here.
        if (betterAuthIds.length > 0) {
          await tx.delete(betterAuthUser).where(inArray(betterAuthUser.id, betterAuthIds));
        }

        return { betterAuthIds };
      });
    },

    async findByEmail(email: string): Promise<User | null> {
      const [user] = await db
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = lower(${email})`)
        .limit(1);

      return user ?? null;
    },

    async findByAuthIdentity(provider: string, providerSubject: string): Promise<User | null> {
      const [row] = await db
        .select({ user: users })
        .from(authIdentities)
        .innerJoin(users, eq(authIdentities.userId, users.id))
        .where(
          and(
            eq(authIdentities.provider, provider),
            eq(authIdentities.providerSubject, providerSubject)
          )
        )
        .limit(1);

      return row?.user ?? null;
    },

    async findOrCreateFromAuthIdentity(input: ExternalAuthIdentityInput): Promise<User> {
      const existingUser = await this.findByAuthIdentity(input.provider, input.providerSubject);

      if (existingUser) {
        await db
          .update(authIdentities)
          .set({
            providerEmail: input.email,
            providerProfile: input.providerProfile ?? {},
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(authIdentities.provider, input.provider),
              eq(authIdentities.providerSubject, input.providerSubject)
            )
          );

        return existingUser;
      }

      return db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            email: input.email.toLowerCase(),
            emailVerifiedAt: input.emailVerifiedAt ?? null,
            fullName: input.fullName ?? null,
          })
          .returning();

        await tx.insert(authIdentities).values({
          userId: user.id,
          provider: input.provider,
          providerSubject: input.providerSubject,
          providerEmail: input.email,
          providerProfile: input.providerProfile ?? {},
          lastSeenAt: new Date(),
        });

        return user;
      });
    },
  };
}
