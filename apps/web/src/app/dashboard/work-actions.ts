"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createWorkItemsRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";

/**
 * The only writes Today needs: name what you are working towards, break it into steps, and
 * mark one done. Everything else on the page is read from work that already happened.
 *
 * A server action is a network entry point, not a function call. Every argument is parsed at
 * runtime — a TypeScript union does not survive the wire, and without this a forged call could
 * write any status string onto any item the person happens to own.
 */

type Result = { ok: true } | { ok: false; error: string };

const FAILED: Result = { ok: false, error: "Could not save that. Please try again." };
const REJECTED: Result = { ok: false, error: "That request did not look right." };

const uuid = z.string().uuid();
const title = z.string().trim().min(1).max(200);
const reason = z.string().trim().max(500);
const stepStatus = z.enum(["open", "active", "blocked", "done", "dropped"]);

export async function setGoalAction(rawTitle: string, rawReason = ""): Promise<Result> {
  const parsed = z.object({ title, reason }).safeParse({ title: rawTitle, reason: rawReason });
  if (!parsed.success) return { ok: false, error: "Give the goal a name." };

  const user = await getCurrentAuthUser();
  if (!user) return FAILED;

  try {
    // One transaction: a goal that was created but never activated would leave the person
    // with a goal they cannot see and no way to reach it.
    await getDatabase().transaction(async (tx) => {
      const repo = createWorkItemsRepository(tx);
      const goal = await repo.create(user.id, {
        kind: "goal",
        title: parsed.data.title,
        reason: parsed.data.reason,
        status: "open",
      });
      await repo.setActiveGoal(user.id, goal.id);
    });
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return FAILED;
  }
}

export async function switchGoalAction(id: string): Promise<Result> {
  if (!uuid.safeParse(id).success) return REJECTED;

  const user = await getCurrentAuthUser();
  if (!user) return FAILED;

  try {
    // In a transaction so the per-person lock inside setActiveGoal is held for both writes.
    await getDatabase().transaction(async (tx) =>
      createWorkItemsRepository(tx).setActiveGoal(user.id, id)
    );
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
export async function addStepAction(rawTitle: string, rawReason = ""): Promise<Result> {
  const parsed = z.object({ title, reason }).safeParse({ title: rawTitle, reason: rawReason });
  if (!parsed.success) return { ok: false, error: "Give the step a name." };

  const user = await getCurrentAuthUser();
  if (!user) return FAILED;

  try {
    const repo = createWorkItemsRepository(getDatabase());
    const goal = (await repo.activeGoal(user.id)) ?? (await repo.listGoals(user.id))[0];
    if (!goal) return { ok: false, error: "Name what you are working towards first." };

    await repo.create(user.id, {
      kind: "step",
      title: parsed.data.title,
      reason: parsed.data.reason,
      parentId: goal.id,
      careerProfileId: goal.careerProfileId,
    });
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return FAILED;
  }
}

/**
 * Moves ONE STEP. Today has no control that finishes a goal or a plan, so neither does this:
 * an action that can be reached from the network may only do the thing the screen offers.
 */
export async function setStepStatusAction(id: string, status: string): Promise<Result> {
  const parsed = z.object({ id: uuid, status: stepStatus }).safeParse({ id, status });
  if (!parsed.success) return REJECTED;

  const user = await getCurrentAuthUser();
  if (!user) return FAILED;

  try {
    const repo = createWorkItemsRepository(getDatabase());
    const item = await repo.get(user.id, parsed.data.id);
    if (!item) return REJECTED;
    if (item.kind !== "step") return { ok: false, error: "Only a step can be ticked off here." };

    await repo.setStatus(user.id, parsed.data.id, parsed.data.status);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return FAILED;
  }
}
