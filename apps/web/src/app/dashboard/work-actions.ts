"use server";

import { revalidatePath } from "next/cache";

import { createWorkItemsRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";

/**
 * The only writes Today needs: name what you are working towards, break it into steps, and
 * mark one done. Everything else on the page is read from work that already happened.
 */

type Result = { ok: true } | { ok: false; error: string };

const FAILED: Result = { ok: false, error: "Could not save that. Please try again." };

async function withWork<T>(
  run: (userId: string, repo: ReturnType<typeof createWorkItemsRepository>) => Promise<T>
) {
  const user = await getCurrentAuthUser();
  if (!user) return null;
  return run(user.id, createWorkItemsRepository(getDatabase()));
}

export async function setGoalAction(title: string, reason = ""): Promise<Result> {
  const clean = title.trim().slice(0, 200);
  if (!clean) return { ok: false, error: "Give the goal a name." };
  try {
    const done = await withWork(async (userId, repo) => {
      const goal = await repo.create(userId, {
        kind: "goal",
        title: clean,
        reason: reason.trim().slice(0, 500),
        status: "active",
      });
      await repo.setActiveGoal(userId, goal.id);
      return true;
    });
    if (!done) return FAILED;
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return FAILED;
  }
}

export async function switchGoalAction(id: string): Promise<Result> {
  try {
    const done = await withWork((userId, repo) => repo.setActiveGoal(userId, id));
    if (!done) return FAILED;
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return FAILED;
  }
}

/**
 * A step hangs under the active goal. When there is no goal yet the step has nowhere honest to
 * live, so the caller is told to name the goal first rather than having one invented for them.
 */
export async function addStepAction(title: string, reason = ""): Promise<Result> {
  const clean = title.trim().slice(0, 200);
  if (!clean) return { ok: false, error: "Give the step a name." };
  try {
    const result = await withWork(async (userId, repo) => {
      const goals = await repo.listGoals(userId);
      const goal = goals.find((row) => row.status === "active") ?? goals[0];
      if (!goal) return "no-goal" as const;
      await repo.create(userId, {
        kind: "step",
        title: clean,
        reason: reason.trim().slice(0, 500),
        parentId: goal.id,
        careerProfileId: goal.careerProfileId,
      });
      return "done" as const;
    });
    if (result === "no-goal") {
      return { ok: false, error: "Name what you are working towards first." };
    }
    if (!result) return FAILED;
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return FAILED;
  }
}

export async function setStepStatusAction(
  id: string,
  status: "open" | "active" | "blocked" | "done" | "dropped"
): Promise<Result> {
  try {
    const done = await withWork((userId, repo) => repo.setStatus(userId, id, status));
    if (!done) return FAILED;
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return FAILED;
  }
}
