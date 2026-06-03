import { createUsersRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthUser = {
  id: string;
  email?: string;
  externalAuthProvider: "supabase";
  externalAuthUserId: string;
};

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error || !data?.claims?.sub) {
      return null;
    }

    const emailClaim = data.claims.email;
    const email = typeof emailClaim === "string" ? emailClaim : undefined;

    if (!email) {
      return null;
    }

    const usersRepository = createUsersRepository(getDatabase());
    const appUser = await usersRepository.findOrCreateFromAuthIdentity({
      provider: "supabase",
      providerSubject: String(data.claims.sub),
      email,
      emailVerifiedAt: data.claims.email_verified ? new Date() : null,
      providerProfile: {
        supabaseClaims: data.claims,
      },
    });

    return {
      id: appUser.id,
      email: appUser.email,
      externalAuthProvider: "supabase",
      externalAuthUserId: String(data.claims.sub),
    };
  } catch {
    return null;
  }
}
