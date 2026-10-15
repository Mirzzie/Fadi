import { and, asc, desc, eq, ne } from "drizzle-orm";

import type { Database, DbOrTx } from "../client";
import {
  projectPlanVersions,
  projectRuns,
  projectSteps,
  type NewProjectStep,
  type ProjectPlanVersion,
  type ProjectRun,
  type ProjectStep,
} from "../schema/index";
import { createWorkItemsRepository } from "./work-items.repository";

/**
 * Decide whether a run is finished from its steps. Done means every step done, from a nonempty
 * set; a skipped step is not a met requirement; reopening reopens. Abandoned runs are left alone.
 */
async function settleRun(db: DbOrTx, runId: string, status: string): Promise<void> {
  if (status === "abandoned") return;
  const steps = await db
    .select({ status: projectSteps.status })
    .from(projectSteps)
    .where(eq(projectSteps.runId, runId));
  const allDone = steps.length > 0 && steps.every((s) => s.status === "done");
  if (allDone && status !== "done") {
    await db
      .update(projectRuns)
      .set({ status: "done", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(projectRuns.id, runId));
  } else if (!allDone && status === "done") {
    await db
      .update(projectRuns)
      .set({ status: "running", completedAt: null, updatedAt: new Date() })
      .where(eq(projectRuns.id, runId));
  }
}

/** Keep Today's project action aligned with the project record that owns its truth. */
async function settleProjectWork(
  db: DbOrTx,
  userId: string,
  runId: string,
  runStatus: string
): Promise<void> {
  const work = createWorkItemsRepository(db);
  const linked = await work.listForRef(userId, { type: "project_run", id: runId });
  const target = runStatus === "done" ? "done" : runStatus === "abandoned" ? "dropped" : "active";

  for (const item of linked) {
    if (item.status !== target) await work.setStatus(userId, item.id, target);
  }
}

export type PlanReason = "replanned" | "started_over" | "step_revised" | "restored_other";

/**
 * Save the run's whole current plan as the next version, before it changes. In the caller's
 * transaction, so a plan is never replaced without being kept. Nothing to keep, nothing saved.
 */
async function keepPlan(tx: DbOrTx, userId: string, runId: string, reason: PlanReason) {
  const steps = await tx
    .select()
    .from(projectSteps)
    .where(eq(projectSteps.runId, runId))
    .orderBy(asc(projectSteps.ordinal));
  if (steps.length === 0) return;
  const [latest] = await tx
    .select({ version: projectPlanVersions.version })
    .from(projectPlanVersions)
    .where(eq(projectPlanVersions.runId, runId))
    .orderBy(desc(projectPlanVersions.version))
    .limit(1);
  await tx.insert(projectPlanVersions).values({
    runId,
    userId,
    version: (latest?.version ?? 0) + 1,
    reason,
    steps: steps.map((step) => ({
      ordinal: step.ordinal,
      title: step.title,
      instruction: step.instruction,
      verify: step.verify,
      produces: step.produces,
      status: step.status,
      completion: step.completion,
      artifact: step.artifact,
      completedAt: step.completedAt?.toISOString() ?? null,
      place: step.place,
      checkCommand: step.checkCommand,
      checkExpect: step.checkExpect,
    })),
  });
}

export function createProjectRunsRepository(db: Database) {
  return {
    async listForUser(userId: string): Promise<ProjectRun[]> {
      return db
        .select()
        .from(projectRuns)
        .where(eq(projectRuns.userId, userId))
        .orderBy(asc(projectRuns.createdAt));
    },

    /** The active project run that fulfils this commitment, if one exists. */
    async getForCommitment(userId: string, commitmentId: string): Promise<ProjectRun | null> {
      const [run] = await db
        .select()
        .from(projectRuns)
        .where(
          and(
            eq(projectRuns.userId, userId),
            eq(projectRuns.commitmentId, commitmentId),
            ne(projectRuns.status, "abandoned")
          )
        )
        .orderBy(desc(projectRuns.createdAt))
        .limit(1);
      return run ?? null;
    },

    async getWithSteps(
      userId: string,
      runId: string
    ): Promise<{ run: ProjectRun; steps: ProjectStep[] } | null> {
      const [run] = await db
        .select()
        .from(projectRuns)
        .where(and(eq(projectRuns.userId, userId), eq(projectRuns.id, runId)))
        .limit(1);
      if (!run) return null;
      const steps = await db
        .select()
        .from(projectSteps)
        .where(eq(projectSteps.runId, runId))
        .orderBy(asc(projectSteps.ordinal));
      return { run, steps };
    },

    /**
     * A run and its steps arrive together or not at all — a run with no steps is a
     * shell the user cannot act on, and a half-written plan is worse than none because
     * it looks finished.
     */
    async createWithSteps(
      userId: string,
      run: {
        title: string;
        detail?: string | null;
        commitmentId?: string | null;
        careerProfileId?: string | null;
        resourceId?: string | null;
        resourceLabel?: string | null;
      },
      steps: Array<Omit<NewProjectStep, "id" | "runId" | "createdAt" | "updatedAt">>
    ): Promise<{ run: ProjectRun; steps: ProjectStep[] }> {
      return db.transaction(async (tx) => {
        const [created] = await tx
          .insert(projectRuns)
          .values({
            userId,
            title: run.title,
            detail: run.detail ?? null,
            commitmentId: run.commitmentId ?? null,
            careerProfileId: run.careerProfileId ?? null,
            resourceId: run.resourceId ?? null,
            resourceLabel: run.resourceLabel ?? null,
            status: "running",
          })
          .returning();
        const inserted = steps.length
          ? await tx
              .insert(projectSteps)
              .values(steps.map((s) => ({ ...s, runId: created.id })))
              .returning()
          : [];
        return { run: created, steps: inserted };
      });
    },

    async setStepStatus(
      userId: string,
      stepId: string,
      patch: {
        status: "pending" | "done" | "skipped";
        artifact?: string | null;
        /** attested | evidenced | verified — see the schema comment. Null when reopened. */
        completion?: "attested" | "evidenced" | "verified" | null;
      }
    ): Promise<ProjectStep | null> {
      return db.transaction(async (tx) => {
        // Scope by owner through the run, so a step id alone cannot reach another user's row.
        const [step] = await tx
          .select({ id: projectSteps.id, runId: projectSteps.runId })
          .from(projectSteps)
          .innerJoin(projectRuns, eq(projectRuns.id, projectSteps.runId))
          .where(and(eq(projectSteps.id, stepId), eq(projectRuns.userId, userId)))
          .limit(1);
        if (!step) return null;

        // Serialize completion per run: two steps finishing at once must agree on the run.
        const [run] = await tx
          .select({ status: projectRuns.status })
          .from(projectRuns)
          .where(eq(projectRuns.id, step.runId))
          .for("update");

        const [updated] = await tx
          .update(projectSteps)
          .set({
            status: patch.status,
            artifact: patch.artifact ?? undefined,
            // Cleared when a step is reopened, so a step cannot keep a completion kind it
            // is no longer completed under.
            completion: patch.status === "done" ? (patch.completion ?? "attested") : null,
            completedAt: patch.status === "done" ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(projectSteps.id, stepId))
          .returning();

        // THE RUN FINISHES HERE, not in a page.
        //
        // Nothing ever marked a run done: every step could be finished and the project stayed
        // "running" forever, so nothing downstream — evidence, résumé, portfolio — had anything
        // to start from. Decided in the same transaction as the step, so the page, AI tools and
        // retries all see one answer. Done means every step done, from a nonempty set; a skipped
        // step is not a met requirement. Reopening a step reopens the run and leaves any saved
        // evidence alone.
        if (run) {
          await settleRun(tx, step.runId, run.status);
          const [settled] = await tx
            .select({ status: projectRuns.status })
            .from(projectRuns)
            .where(eq(projectRuns.id, step.runId))
            .limit(1);
          if (settled) await settleProjectWork(tx, userId, step.runId, settled.status);
        }
        return updated ?? null;
      });
    },

    /**
     * Bring a run's status in line with its steps — for runs whose steps were all finished
     * before completion was decided here. Safe to call repeatedly.
     */
    async settle(userId: string, runId: string): Promise<void> {
      await db.transaction(async (tx) => {
        const [run] = await tx
          .select({ status: projectRuns.status })
          .from(projectRuns)
          .where(and(eq(projectRuns.id, runId), eq(projectRuns.userId, userId)))
          .for("update");
        if (run) {
          await settleRun(tx, runId, run.status);
          const [settled] = await tx
            .select({ status: projectRuns.status })
            .from(projectRuns)
            .where(eq(projectRuns.id, runId))
            .limit(1);
          if (settled) await settleProjectWork(tx, userId, runId, settled.status);
        }
      });
    },

    /**
     * Save a finished project as evidence, exactly once.
     *
     * The run row is locked for the whole save. If it already points at an evidence item, that
     * item is returned and `create` is never called — so a retry, a double click or a second
     * tool call cannot admit the same project twice. `create` runs inside the same transaction,
     * so the link and the evidence land together or not at all.
     */
    async saveEvidenceOnce<T extends { id: string }>(
      userId: string,
      runId: string,
      create: (tx: Database) => Promise<T>
    ): Promise<
      | { status: "created"; evidenceItemId: string; commitmentId: string | null }
      | { status: "existing"; evidenceItemId: string }
      | { status: "not_finished" | "not_found" }
    > {
      return db.transaction(async (tx) => {
        const [run] = await tx
          .select()
          .from(projectRuns)
          .where(and(eq(projectRuns.id, runId), eq(projectRuns.userId, userId)))
          .for("update");
        if (!run) return { status: "not_found" as const };
        if (run.evidenceItemId)
          return { status: "existing" as const, evidenceItemId: run.evidenceItemId };
        if (run.status !== "done") return { status: "not_finished" as const };

        const created = await create(tx as unknown as Database);
        await tx
          .update(projectRuns)
          .set({ evidenceItemId: created.id, updatedAt: new Date() })
          .where(eq(projectRuns.id, runId));
        return {
          status: "created" as const,
          evidenceItemId: created.id,
          commitmentId: run.commitmentId,
        };
      });
    },

    /**
     * Rewrite a step that has NOT been completed — the fix for a step that could not run as
     * written. A completed step is never rewritten: what someone did against it, and the
     * receipt for it, must keep describing what they actually did.
     */
    async reviseOpenStep(
      userId: string,
      stepId: string,
      patch: { instruction: string; verify?: string | null }
    ): Promise<ProjectStep | null> {
      return db.transaction(async (tx) => {
        const [step] = await tx
          .select({ id: projectSteps.id, status: projectSteps.status, runId: projectSteps.runId })
          .from(projectSteps)
          .innerJoin(projectRuns, eq(projectRuns.id, projectSteps.runId))
          .where(and(eq(projectSteps.id, stepId), eq(projectRuns.userId, userId)))
          .limit(1);
        if (!step || step.status === "done") return null;

        // The step as it was written stays readable, and can come back.
        await keepPlan(tx, userId, step.runId, "step_revised");
        const [updated] = await tx
          .update(projectSteps)
          .set({
            instruction: patch.instruction,
            ...(patch.verify ? { verify: patch.verify } : {}),
            updatedAt: new Date(),
          })
          .where(eq(projectSteps.id, stepId))
          .returning();
        return updated ?? null;
      });
    },

    /**
     * Abandon a run — kept, not deleted.
     *
     * A plan someone stopped following is information: it is how "I tried this and it
     * wasn't for me" stays visible instead of becoming a gap nobody can explain later.
     */
    async abandon(userId: string, runId: string): Promise<void> {
      await db.transaction(async (tx) => {
        const rows = await tx
          .update(projectRuns)
          .set({ status: "abandoned", completedAt: null, updatedAt: new Date() })
          .where(and(eq(projectRuns.userId, userId), eq(projectRuns.id, runId)))
          .returning({ id: projectRuns.id });
        if (rows.length > 0) await settleProjectWork(tx, userId, runId, "abandoned");
      });
    },

    /**
     * Delete a run outright, steps and all.
     *
     * Abandoning is the honest default, but a plan generated by mistake is not history
     * worth keeping, and refusing to delete it is the platform deciding it knows better
     * than the person whose account it is.
     */
    async remove(userId: string, runId: string): Promise<boolean> {
      return db.transaction(async (tx) => {
        const work = createWorkItemsRepository(tx);
        const linked = await work.listForRef(userId, { type: "project_run", id: runId });
        const rows = await tx
          .delete(projectRuns)
          .where(and(eq(projectRuns.userId, userId), eq(projectRuns.id, runId)))
          .returning({ id: projectRuns.id });
        if (rows.length === 0) return false;
        for (const item of linked) await work.remove(userId, item.id);
        return true;
      });
    },

    /** Where this project's work lives. Set once at commit; changed if the person moves it. */
    /**
     * Replace a run's steps, keeping the run.
     *
     * A plan can be wrong — steps describing a Windows installer against an Ubuntu lab —
     * and without this the only remedy was to abandon the project and start again, losing
     * its workspace, its history and whatever had been recorded against it.
     *
     * One transaction: a run must never be left with the old steps deleted and the new
     * ones unwritten, which is a project that has become an empty shell.
     */
    /**
     * Replace the steps someone has NOT finished, keeping the ones they have.
     *
     * This used to delete every step — and with them every result and receipt — so improving a
     * plan erased what the person had already accomplished. Finished steps now stay exactly as
     * they are; the new steps are numbered after them. The machine the run is placed on is not
     * changed here: a lab may already be running there, and moving it is its own decision.
     */
    async replaceSteps(
      userId: string,
      runId: string,
      steps: Array<Omit<NewProjectStep, "id" | "runId" | "createdAt" | "updatedAt">>,
      /** Start over: finished steps go too, and the new plan starts at step one. */
      options: { keepDone?: boolean } = {}
    ): Promise<{ kept: ProjectStep[]; added: ProjectStep[] } | null> {
      const keepDone = options.keepDone ?? true;
      return db.transaction(async (tx) => {
        const [run] = await tx
          .select({ id: projectRuns.id, status: projectRuns.status })
          .from(projectRuns)
          .where(and(eq(projectRuns.userId, userId), eq(projectRuns.id, runId)))
          .for("update");
        if (!run) return null;

        const existing = await tx
          .select()
          .from(projectSteps)
          .where(eq(projectSteps.runId, runId))
          .orderBy(asc(projectSteps.ordinal));
        await keepPlan(tx, userId, runId, keepDone ? "replanned" : "started_over");
        const kept = keepDone ? existing.filter((step) => step.status === "done") : [];
        const after = kept.reduce((max, step) => Math.max(max, step.ordinal), 0);

        await tx
          .delete(projectSteps)
          .where(
            keepDone
              ? and(eq(projectSteps.runId, runId), ne(projectSteps.status, "done"))
              : eq(projectSteps.runId, runId)
          );

        const added = steps.length
          ? await tx
              .insert(projectSteps)
              .values(steps.map((step, index) => ({ ...step, ordinal: after + index + 1, runId })))
              .returning()
          : [];

        await tx
          .update(projectRuns)
          .set({ updatedAt: new Date() })
          .where(eq(projectRuns.id, runId));
        await settleRun(tx, runId, run.status);
        const [settled] = await tx
          .select({ status: projectRuns.status })
          .from(projectRuns)
          .where(eq(projectRuns.id, runId))
          .limit(1);
        if (settled) await settleProjectWork(tx, userId, runId, settled.status);
        return { kept, added };
      });
    },

    /**
     * A FRESH START: the run's steps and earlier plans are deleted and it is running again with
     * nothing done. Its title, description, placement and history of actions (receipts) stay.
     */
    async resetProgress(userId: string, runId: string): Promise<boolean> {
      return db.transaction(async (tx) => {
        const [run] = await tx
          .select({ id: projectRuns.id })
          .from(projectRuns)
          .where(and(eq(projectRuns.userId, userId), eq(projectRuns.id, runId)))
          .for("update");
        if (!run) return false;
        await tx.delete(projectSteps).where(eq(projectSteps.runId, runId));
        await tx.delete(projectPlanVersions).where(eq(projectPlanVersions.runId, runId));
        await tx
          .update(projectRuns)
          .set({ status: "running", completedAt: null, updatedAt: new Date() })
          .where(eq(projectRuns.id, runId));
        await settleProjectWork(tx, userId, runId, "running");
        return true;
      });
    },

    /** Every earlier plan of this run, newest first. Owner-scoped. */
    async listPlanVersions(userId: string, runId: string): Promise<ProjectPlanVersion[]> {
      return db
        .select()
        .from(projectPlanVersions)
        .where(and(eq(projectPlanVersions.runId, runId), eq(projectPlanVersions.userId, userId)))
        .orderBy(desc(projectPlanVersions.version));
    },

    /**
     * Bring an earlier plan back exactly as it was — its steps, their progress and what they
     * produced. The plan it replaces is kept first, so going back is itself reversible.
     */
    async restorePlanVersion(
      userId: string,
      runId: string,
      versionId: string
    ): Promise<{ steps: number } | null> {
      return db.transaction(async (tx) => {
        const [run] = await tx
          .select({ id: projectRuns.id, status: projectRuns.status })
          .from(projectRuns)
          .where(and(eq(projectRuns.userId, userId), eq(projectRuns.id, runId)))
          .for("update");
        if (!run) return null;
        const [version] = await tx
          .select()
          .from(projectPlanVersions)
          .where(
            and(
              eq(projectPlanVersions.id, versionId),
              eq(projectPlanVersions.runId, runId),
              eq(projectPlanVersions.userId, userId)
            )
          )
          .limit(1);
        if (!version) return null;

        await keepPlan(tx, userId, runId, "restored_other");
        await tx.delete(projectSteps).where(eq(projectSteps.runId, runId));
        if (version.steps.length > 0) {
          await tx.insert(projectSteps).values(
            version.steps.map((step) => ({
              runId,
              ordinal: step.ordinal,
              title: step.title,
              instruction: step.instruction,
              verify: step.verify,
              produces: step.produces,
              status: step.status,
              completion: step.completion,
              artifact: step.artifact,
              completedAt: step.completedAt ? new Date(step.completedAt) : null,
              place: step.place ?? null,
              checkCommand: step.checkCommand ?? null,
              checkExpect: step.checkExpect ?? null,
            }))
          );
        }
        await tx.update(projectRuns).set({ updatedAt: new Date() }).where(eq(projectRuns.id, runId));
        await settleRun(tx, runId, run.status);
        const [settled] = await tx
          .select({ status: projectRuns.status })
          .from(projectRuns)
          .where(eq(projectRuns.id, runId))
          .limit(1);
        if (settled) await settleProjectWork(tx, userId, runId, settled.status);
        return { steps: version.steps.length };
      });
    },

    /**
     * Place a run on one of the person's registered machines (a VMware VM), as its own explicit
     * decision. The caller has already checked the machine is theirs.
     */
    async placeOnResource(
      userId: string,
      runId: string,
      resource: { id: string; label: string }
    ): Promise<boolean> {
      const updated = await db
        .update(projectRuns)
        .set({ resourceId: resource.id, resourceLabel: resource.label, updatedAt: new Date() })
        .where(and(eq(projectRuns.id, runId), eq(projectRuns.userId, userId)))
        .returning({ id: projectRuns.id });
      return updated.length > 0;
    },

    /** Move a run to this computer, as its own explicit decision (never a side effect of a replan). */
    async placeOnThisComputer(userId: string, runId: string): Promise<boolean> {
      const updated = await db
        .update(projectRuns)
        .set({ resourceId: null, resourceLabel: null, updatedAt: new Date() })
        .where(and(eq(projectRuns.id, runId), eq(projectRuns.userId, userId)))
        .returning({ id: projectRuns.id });
      return updated.length > 0;
    },

    async setWorkspace(
      userId: string,
      runId: string,
      workspace: { workspaceKind: string; workspaceRef: string; repoUrl: string | null }
    ): Promise<void> {
      await db
        .update(projectRuns)
        .set({ ...workspace, updatedAt: new Date() })
        .where(and(eq(projectRuns.userId, userId), eq(projectRuns.id, runId)));
    },

    async setRunStatus(userId: string, runId: string, status: string): Promise<void> {
      await db.transaction(async (tx) => {
        const rows = await tx
          .update(projectRuns)
          .set({
            status,
            completedAt: status === "done" ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(and(eq(projectRuns.userId, userId), eq(projectRuns.id, runId)))
          .returning({ id: projectRuns.id });
        if (rows.length > 0) await settleProjectWork(tx, userId, runId, status);
      });
    },
  };
}
