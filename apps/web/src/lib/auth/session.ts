import { createUsersRepository } from "@careeros/database";
import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";

export type AuthUser = {
  id: string;
  email?: string;
  externalAuthProvider: "better_auth";
  externalAuthUserId: string;
};

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || !session.user.email) {
      return null;
    }

    const emailVerifiedAt = session.user.emailVerified ? new Date() : null;

    const usersRepository = createUsersRepository(getDatabase());
    const appUser = await usersRepository.findOrCreateFromAuthIdentity({
      provider: "better_auth",
      providerSubject: session.user.id,
      email: session.user.email,
      emailVerifiedAt,
      fullName: session.user.name,
      providerProfile: {
        betterAuthUserId: session.user.id,
        emailVerified: session.user.emailVerified,
      },
    });

    return {
      id: appUser.id,
      email: appUser.email,
      externalAuthProvider: "better_auth",
      externalAuthUserId: session.user.id,
    };
  } catch (error) {
    logger.error("auth.session.resolve_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}
