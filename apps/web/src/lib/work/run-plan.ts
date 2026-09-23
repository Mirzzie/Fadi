import "server-only";

import { createJobsRepository, createWorkItemsRepository, type WorkItem } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { executeFadiTool } from "@/lib/ai/tools/registry";
import { logger } from "@/lib/observability/logger";
import { planTemplate, type PlanContext, type PlanTemplate } from "./plans";

/**
 * Running a plan, one step at a time.
 *
 * Deliberately one step per call, and deliberately stopping the moment a step is the person's:
 * an agent that runs a six-step plan to completion while nobody is looking has taken six
 * decisions on their behalf, and the fit check in the middle exists precisely so that one of
 * them can be "don't apply". So Fadi does the next thing it can do, says what happened, and
 * waits — the person decides whether there is a next thing.
 *
 * Every step runs through `executeFadiTool`, so each one leaves the same receipt as any other
 * capability call, attached to the step it served.
 */

export type StepOutcome =
  | { state: "ran"; step: WorkItem; summary: string }
  | { state: "waiting"; step: WorkItem }
  | { state: "stopped"; step: WorkItem; summary: string }
  | { state: "finished" }
  | { state: "unavailable"; reason: string };

/** The plan's own refs carry what it is about; arguments are computed from them, never stored. */
async function contextFor(userId: string, plan: WorkItem): Promise<PlanContext> {
  const jobRef = plan.refs.find((ref) => ref.type === "job");
  if (!jobRef) return { userId, job: null };

  const job = await createJobsRepository(getDatabase()).findByIdForUser(userId, jobRef.id);
  return {
    userId,
    job: job
      ? {
          id: job.id,
          title: job.title,
          company: job.company,
          description: job.description ?? "",
        }
      : null,
  };
}

function templateOf(plan: WorkItem): PlanTemplate | undefined {
  const ref = plan.refs.find((item) => item.type === "template");
  return ref ? planTemplate(ref.id) : undefined;
}

/**
 * Start a plan under the person's active goal.
 *
 * The plan hangs under a goal because work with no stated purpose is how Fadi ends up busy and
 * useless. When there is no active goal the caller is told so rather than having one invented.
 */
export async function startPlan(
  userId: string,
  templateId: string,
  refs: { type: string; id: string }[],
  options: { status?: "active" | "open" } = {}
): Promise<{ ok: true; planId: string } | { ok: false; reason: string }> {
  const template = planTemplate(templateId);
  if (!template) return { ok: false, reason: "Fadi does not know that plan." };

  const db = getDatabase();
  const work = createWorkItemsRepository(db);
  const goal = await work.activeGoal(userId);
  if (!goal) return { ok: false, reason: "Set what you are working towards first." };

  // One plan per thing. Pressing "Apply with Fadi" twice, or saying it twice, must land you
  // back in the plan you already have — two plans for one posting means two tailored CVs, two
  // sets of receipts, and a person deciding which of Fadi's answers is the real one.
  const existing = (await work.listForRef(userId, { type: "template", id: templateId })).find(
    (item) =>
      item.kind === "plan" &&
      (item.status === "active" || item.status === "open") &&
      refs.every((ref) => item.refs.some((held) => held.type === ref.type && held.id === ref.id))
  );
  if (existing) return { ok: true, planId: existing.id };

  // One thing at a time. Two plans running at once is two sets of steps competing for one
  // screen and one person's attention, and neither of them is "what Fadi is doing".
  const busy = options.status === "open" ? undefined : await runningPlan(userId);
  if (busy) {
    return {
      ok: false,
      reason: `Fadi is already working on "${busy.title}". Finish or stop that first.`,
    };
  }

  const context = await contextFor(userId, { refs } as WorkItem);

  return db.transaction(async (tx) => {
    const scoped = createWorkItemsRepository(tx);
    const plan = await scoped.create(userId, {
      kind: "plan",
      title: template.title(context),
      parentId: goal.id,
      careerProfileId: goal.careerProfileId,
      status: options.status ?? "active",
      refs: [{ type: "template", id: template.id }, ...refs],
    });

    for (const [index, step] of template.steps.entries()) {
      await scoped.create(userId, {
        kind: "step",
        title: step.title,
        reason: step.reason,
        parentId: plan.id,
        careerProfileId: goal.careerProfileId,
        sortOrder: index,
        refs: step.capability ? [{ type: "capability", id: step.capability }] : [],
      });
    }
    return { ok: true as const, planId: plan.id };
  });
}

/**
 * Lay a plan out without starting it.
 *
 * This is how background work is allowed to reach the person: it can have the paperwork ready,
 * and it cannot begin. An agent that woke up and drafted a CV for a role nobody had looked at
 * would be spending their AI allowance and writing in their name on its own initiative — so a
 * proposal is a plan with its steps written and its status `open`, waiting on one press.
 *
 * At most one waiting at a time, and never while something is running: a queue of suggestions
 * is the card wall Today was built to replace.
 */
export async function proposePlan(
  userId: string,
  templateId: string,
  refs: { type: string; id: string }[]
): Promise<{ ok: true; planId: string } | { ok: false; reason: string }> {
  const work = createWorkItemsRepository(getDatabase());
  const goal = await work.activeGoal(userId);
  if (!goal) return { ok: false, reason: "No active goal." };

  if (await runningPlan(userId)) return { ok: false, reason: "Already working on something." };

  const waiting = (await work.listChildren(userId, goal.id)).find(
    (child) => child.kind === "plan" && child.status === "open"
  );
  if (waiting) return { ok: false, reason: "A proposal is already waiting." };

  const started = await startPlan(userId, templateId, refs, { status: "open" });
  return started;
}

/** The plan Fadi has laid out and not started. Today asks the person about this one. */
export async function proposedPlan(userId: string): Promise<WorkItem | undefined> {
  const work = createWorkItemsRepository(getDatabase());
  const goal = await work.activeGoal(userId);
  if (!goal) return undefined;

  const children = await work.listChildren(userId, goal.id);
  return children.find((child) => child.kind === "plan" && child.status === "open");
}

/** The plan a person is in the middle of: active, under their active goal, most recent first. */
export async function runningPlan(userId: string): Promise<WorkItem | undefined> {
  const work = createWorkItemsRepository(getDatabase());
  const goal = await work.activeGoal(userId);
  if (!goal) return undefined;

  const children = await work.listChildren(userId, goal.id);
  return children.find((child) => child.kind === "plan" && child.status === "active");
}

export async function planSteps(userId: string, planId: string): Promise<WorkItem[]> {
  return createWorkItemsRepository(getDatabase()).listChildren(userId, planId);
}

/**
 * Do the next thing this plan can do by itself.
 *
 * Returns `waiting` the moment the next step has no capability — that is the person's step, and
 * Fadi neither does it nor skips past it to something easier further down the list.
 */
export async function advancePlan(userId: string, planId: string): Promise<StepOutcome> {
  const db = getDatabase();
  const work = createWorkItemsRepository(db);

  const plan = await work.get(userId, planId);
  if (!plan || plan.kind !== "plan") return { state: "unavailable", reason: "No such plan." };

  const template = templateOf(plan);
  if (!template) return { state: "unavailable", reason: "Fadi does not know that plan." };

  const steps = await work.listChildren(userId, planId);

  // The plan's position is its FIRST unfinished step, not the first one Fadi happens to be able
  // to do. Searching for the next runnable step let a plan walk past a step that had stopped —
  // tailoring a CV for a posting the previous step had just found closed.
  const next = steps.find((step) => step.status !== "done" && step.status !== "dropped");
  if (!next) {
    await work.setStatus(userId, planId, "done");
    return { state: "finished" };
  }
  if (next.status === "blocked") {
    return { state: "stopped", step: next, summary: next.reason };
  }

  const capability = next.refs.find((ref) => ref.type === "capability")?.id;
  if (!capability) return { state: "waiting", step: next };

  const shape = template.steps[next.sortOrder];
  const context = await contextFor(userId, plan);

  await work.setStatus(userId, next.id, "active");
  const result = await executeFadiTool(capability, shape?.args?.(context) ?? {}, {
    userId,
    surface: "chat",
    workItemId: next.id,
    // Steps that draft need the person's own provider, exactly as the chat route gives it.
    generate: (await getUserDocGenerate(userId)) ?? undefined,
  });

  // A capability that asked a question or refused has NOT done the step. Leaving it open is the
  // honest state: the plan stops here and says why, rather than ticking a box nobody earned.
  const performed = result.outcome === "performed" || (!result.outcome && !result.isError);
  if (!performed) {
    await work.setStatus(userId, next.id, "blocked", { reason: result.summary.slice(0, 500) });
    logger.info("work.plan.stopped", { userId, planId, step: next.id, capability });
    return { state: "stopped", step: next, summary: result.summary };
  }

  // Keep what the step FOUND, not just that it ran. A read step ticks green and leaves no
  // receipt by design, so without this the plan could say "checked the posting is still open"
  // without ever telling the person the answer.
  await work.update(userId, next.id, { detail: result.summary.slice(0, 500) });
  await work.setStatus(userId, next.id, "done");
  const document = (result.data as { id?: string } | undefined)?.id;
  if (document && capability === "generate_document") {
    await work
      .recordOutput(userId, {
        workItemId: next.id,
        kind: "document",
        refId: document,
        label: next.title,
      })
      .catch(() => {});
  }
  return { state: "ran", step: next, summary: result.summary };
}
