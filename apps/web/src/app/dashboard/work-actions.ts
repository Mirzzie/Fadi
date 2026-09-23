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

const FAILED = { ok: false, error: "Could not save that. Please try again." } as const;
const REJECTED = { ok: false, error: "That request did not look right." } as const;

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

/**
 * Do the next thing the running plan can do by itself, and stop.
 *
 * One step per press on purpose. A plan that runs to the end unattended has taken every
 * decision in it, including the fit check whose honest answer is sometimes "don't apply".
 */
export async function advancePlanAction(
  planId: string
): Promise<{ ok: true; state: string; summary?: string } | { ok: false; error: string }> {
  if (!uuid.safeParse(planId).success) return { ok: false, error: REJECTED.error };

  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, error: FAILED.error };

  try {
    const { advancePlan } = await import("@/lib/work/run-plan");
    const outcome = await advancePlan(user.id, planId);
    revalidatePath("/dashboard");

    if (outcome.state === "unavailable") return { ok: false, error: outcome.reason };
    return {
      ok: true,
      state: outcome.state,
      summary: "summary" in outcome ? outcome.summary : undefined,
    };
  } catch (error) {
    // The person asked Fadi to do something and it did not happen — say so in their words.
    return {
      ok: false,
      error: error instanceof Error ? error.message : "That step did not finish.",
    };
  }
}

/** Put the plan down. The steps stay, so what was already done is still on the record. */
export async function stopPlanAction(planId: string): Promise<Result> {
  if (!uuid.safeParse(planId).success) return REJECTED;

  const user = await getCurrentAuthUser();
  if (!user) return FAILED;

  try {
    const repo = createWorkItemsRepository(getDatabase());
    const plan = await repo.get(user.id, planId);
    if (!plan || plan.kind !== "plan") return REJECTED;

    await repo.setStatus(user.id, planId, "dropped", { reason: "You stopped it." });
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return FAILED;
  }
}

/**
 * "Apply with Fadi" — turn a posting into the plan for applying to it.
 *
 * The plan is created, not run. The person sees the six steps on Today and presses on when they
 * want the next one; nothing about a job card should quietly start drafting in their name.
 */
export async function applyWithFadiAction(
  jobId: string
): Promise<{ ok: true; planId: string } | { ok: false; error: string }> {
  if (!uuid.safeParse(jobId).success) return { ok: false, error: REJECTED.error };

  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, error: FAILED.error };

  try {
    const { startPlan } = await import("@/lib/work/run-plan");
    const started = await startPlan(user.id, "apply-to-role", [{ type: "job", id: jobId }]);
    if (!started.ok) return { ok: false, error: started.reason };

    revalidatePath("/dashboard");
    return { ok: true, planId: started.planId };
  } catch {
    return { ok: false, error: FAILED.error };
  }
}

/**
 * What one line would start, named before anything happens.
 *
 * Read-only: the command bar asks this as the person types, and only a deliberate press turns
 * the answer into a plan. Naming the target first is the difference between an orchestrator and
 * a button that guesses.
 */
export async function resolveIntentAction(
  text: string
): Promise<{ label: string; template: string; refs: { type: string; id: string }[] } | null> {
  if (text.trim().length < 3) return null;

  const user = await getCurrentAuthUser();
  if (!user) return null;

  try {
    const { resolveIntent } = await import("@/lib/work/intent");
    const intent = await resolveIntent(user.id, text.slice(0, 200));
    return intent.kind === "plan"
      ? { label: intent.label, template: intent.template, refs: intent.refs }
      : null;
  } catch {
    return null;
  }
}

/** Start a plan the command bar has already named back to the person. */
export async function startPlanAction(
  template: string,
  refs: { type: string; id: string }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z
    .object({
      template: z.enum(["apply-to-role"]),
      refs: z
        .array(z.object({ type: z.enum(["job"]), id: uuid }))
        .min(1)
        .max(4),
    })
    .safeParse({ template, refs });
  if (!parsed.success) return { ok: false, error: REJECTED.error };

  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, error: FAILED.error };

  try {
    const { startPlan } = await import("@/lib/work/run-plan");
    const started = await startPlan(user.id, parsed.data.template, parsed.data.refs);
    if (!started.ok) return { ok: false, error: started.reason };

    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return { ok: false, error: FAILED.error };
  }
}

/** Take up a plan Fadi laid out. This is the press that lets it act. */
export async function startProposedPlanAction(planId: string): Promise<Result> {
  if (!uuid.safeParse(planId).success) return REJECTED;

  const user = await getCurrentAuthUser();
  if (!user) return FAILED;

  try {
    const repo = createWorkItemsRepository(getDatabase());
    const plan = await repo.get(user.id, planId);
    if (!plan || plan.kind !== "plan" || plan.status !== "open") return REJECTED;

    await repo.setStatus(user.id, planId, "active");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return FAILED;
  }
}

/** Not now. The plan goes, and the reason it was offered stays in the record. */
export async function dismissProposedPlanAction(planId: string): Promise<Result> {
  if (!uuid.safeParse(planId).success) return REJECTED;

  const user = await getCurrentAuthUser();
  if (!user) return FAILED;

  try {
    const repo = createWorkItemsRepository(getDatabase());
    const plan = await repo.get(user.id, planId);
    if (!plan || plan.kind !== "plan") return REJECTED;

    await repo.setStatus(user.id, planId, "dropped", { reason: "You said not now." });
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return FAILED;
  }
}
