import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../client";
import { authIdentities, users, type User } from "../schema/index";

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

    /** Delete the domain user; FK cascades remove all their career data. */
    async deleteById(id: string): Promise<void> {
      await db.delete(users).where(eq(users.id, id));
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
