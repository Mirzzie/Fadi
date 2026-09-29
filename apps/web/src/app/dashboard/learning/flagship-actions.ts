"use server";

import { revalidatePath } from "next/cache";

import { commitToProjectAction } from "@/app/dashboard/learning/actions";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { flagshipDetail } from "@/lib/learning/flagship-rules";
import { getFlagships, refreshFlagships } from "@/lib/learning/flagships";

/** Research this month's problems again and re-propose the flagships for the active direction. */
export async function refreshFlagshipsAction(): Promise<{ ok: boolean; message?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const result = await refreshFlagships(user.id);
  if (!result.ok) return result;
  revalidatePath("/dashboard/learning");
  return { ok: true };
}

/**
 * Take one on. It becomes an ordinary commitment and project — the scenario first, so the
 * README, walkthrough and posts all open with the business problem it answers.
 */
export async function startFlagshipAction(input: {
  title: string;
}): Promise<{ ok: boolean; message?: string; runId?: string | null }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const { flagships } = await getFlagships(user.id);
  // By title, from what was stored: the client names which one, never what it says.
  const flagship = flagships.find((item) => item.title === input.title);
  if (!flagship)
    return { ok: false, message: "That project is no longer on the list. Refresh it." };
  return commitToProjectAction({
    gap: "Flagship project",
    title: flagship.title,
    detail: flagshipDetail(flagship),
    kind: "project",
    searchQuery: flagship.title,
  });
}
