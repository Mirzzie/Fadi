"use server";

import { revalidatePath } from "next/cache";

import { createProfilesRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";

/** Career PHASE — one product, two modes (never two forks). */
export type CareerMode = "apply" | "prepare";

/**
 * Switch the user's career phase. "apply" leads with the pipeline (actively job-hunting);
 * "prepare" leads with building real, provable evidence + interview practice. Both share the
 * same record — the point of a mode, not a separate product. Career-agnostic.
 */
export async function setCareerModeAction(mode: CareerMode): Promise<{ ok: boolean }> {
  if (mode !== "apply" && mode !== "prepare") return { ok: false };
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };

  const db = getDatabase();
  const repo = createProfilesRepository(db);
  const existing = (await repo.getByUserId(user.id))?.jobPreferences ?? {};
  await repo.setJobPreferences(user.id, { ...existing, mode });
  revalidatePath("/dashboard");
  return { ok: true };
}
