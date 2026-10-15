"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createProjectRunsRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { formatDay } from "@/lib/format/date";

/**
 * A project's earlier plans: every plan that was replaced (re-planned, started over, a step
 * corrected by Fadi), readable in full and restorable exactly as it was.
 */

export type PlanVersionView = {
  id: string;
  version: number;
  /** Why it was set aside, in the person's words. */
  why: string;
  when: string;
  done: number;
  total: number;
  steps: Array<{
    ordinal: number;
    title: string;
    instruction: string;
    verify: string | null;
    status: string;
    artifact: string | null;
  }>;
};

const WHY: Record<string, string> = {
  replanned: "replaced when you planned the remaining steps again",
  started_over: "replaced when you started the project over",
  step_revised: "before Fadi corrected a step",
  restored_other: "replaced when you brought back an earlier plan",
};

export async function planHistoryAction(input: {
  runId: string;
}): Promise<{ ok: true; versions: PlanVersionView[] } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.runId);
  if (!id.success) return { ok: false, message: "Unknown project." };
  const versions = await createProjectRunsRepository(getDatabase()).listPlanVersions(
    user.id,
    id.data
  );
  return {
    ok: true,
    versions: versions.map((v) => ({
      id: v.id,
      version: v.version,
      why: WHY[v.reason] ?? "replaced",
      when: formatDay(v.createdAt),
      done: v.steps.filter((s) => s.status === "done").length,
      total: v.steps.length,
      steps: v.steps.map((s) => ({
        ordinal: s.ordinal,
        title: s.title,
        instruction: s.instruction,
        verify: s.verify,
        status: s.status,
        artifact: s.artifact,
      })),
    })),
  };
}

/** Use an earlier plan again. The current plan is kept first, so this can be undone the same way. */
export async function restorePlanAction(input: {
  runId: string;
  versionId: string;
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const parsed = z
    .object({ runId: z.string().uuid(), versionId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Unknown plan." };
  const restored = await createProjectRunsRepository(getDatabase()).restorePlanVersion(
    user.id,
    parsed.data.runId,
    parsed.data.versionId
  );
  if (!restored) return { ok: false, message: "That plan isn't available." };
  revalidatePath("/dashboard/learning");
  return {
    ok: true,
    message: `Back on the earlier plan (${restored.steps} steps, with their progress). The plan you were on is kept under Earlier plans.`,
  };
}
