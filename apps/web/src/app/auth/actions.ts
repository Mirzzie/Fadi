"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authFormSchema, type AuthFormValues } from "@/lib/auth/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthActionResult = {
  ok: boolean;
  message?: string;
  redirectTo?: string;
};

function getSafeAuthErrorMessage(message?: string) {
  if (!message) {
    return "Authentication failed. Please try again.";
  }

  return message;
}

async function getRequestOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");

  return origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function signInWithPasswordAction(values: AuthFormValues): Promise<AuthActionResult> {
  const parsed = authFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check your email and password.",
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      return {
        ok: false,
        message: getSafeAuthErrorMessage(error.message),
      };
    }

    return {
      ok: true,
      redirectTo: "/dashboard",
    };
  } catch {
    return {
      ok: false,
      message: "Supabase authentication is not configured yet.",
    };
  }
}

export async function signUpWithPasswordAction(values: AuthFormValues): Promise<AuthActionResult> {
  const parsed = authFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check your email and password.",
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const origin = await getRequestOrigin();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      return {
        ok: false,
        message: getSafeAuthErrorMessage(error.message),
      };
    }

    if (!data.session) {
      return {
        ok: true,
        message: "Account created. Check your email to confirm your address before signing in.",
      };
    }

    return {
      ok: true,
      redirectTo: "/dashboard",
    };
  } catch {
    return {
      ok: false,
      message: "Supabase authentication is not configured yet.",
    };
  }
}

export async function signOutAction() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // If auth is not configured locally, still return the user to the sign-in shell.
  }

  redirect("/auth/sign-in");
}
