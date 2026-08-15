"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { createProfilesRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { MODE_COOKIE, type CareerMode } from "./mode";

/**
 * Switch the user's career phase. "apply" leads with the pipeline (actively job-hunting);
 * "prepare" leads with building real, provable evidence + interview practice. Both share the
 * same record — the point of a mode, not a separate product. Career-agnostic.
 *
 * Persists to the DB (durable, cross-device) AND a cookie (so the next server render paints the
 * right phase before any JS runs — the fix for the hydration mismatch).
 */
export async function setCareerModeAction(mode: CareerMode): Promise<{ ok: boolean }> {
  if (mode !== "apply" && mode !== "prepare") return { ok: false };
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };

  const db = getDatabase();
  const repo = createProfilesRepository(db);
  const existing = (await repo.getByUserId(user.id))?.jobPreferences ?? {};
  await repo.setJobPreferences(user.id, { ...existing, mode });

  (await cookies()).set(MODE_COOKIE, mode, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/dashboard");
  return { ok: true };
}
