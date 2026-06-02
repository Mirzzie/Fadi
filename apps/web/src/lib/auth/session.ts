import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthUser = {
  id: string;
  email?: string;
};

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error || !data?.claims?.sub) {
      return null;
    }

    const emailClaim = data.claims.email;

    return {
      id: String(data.claims.sub),
      email: typeof emailClaim === "string" ? emailClaim : undefined,
    };
  } catch {
    return null;
  }
}
