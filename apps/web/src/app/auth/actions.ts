"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { logger } from "@/lib/observability/logger";

export type AuthActionResult = {
  ok: boolean;
  message?: string;
  redirectTo?: string;
};

async function getRequestOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");

  return origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function signOutAction() {
  try {
    await auth.api.signOut({
      headers: await headers(),
    });
  } catch (error) {
    const origin = await getRequestOrigin();
    logger.warn("auth.sign_out_failed", {
      origin,
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  redirect("/auth/sign-in");
}
