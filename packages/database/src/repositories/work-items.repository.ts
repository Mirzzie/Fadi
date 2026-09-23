import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import type { DbOrTx } from "../client";
import {
  agentMessages,
  workExecutions,
  workItems,
  workOutputs,
  type WorkExecution,
  type WorkItem,
  type WorkOutput,
} from "../schema";

/** goal → plan → step. A kind may only hang under the kinds listed here. */
const ALLOWED_PARENTS: Record<WorkKind, WorkKind[]> = {
  goal: [],
  plan: ["goal"],
  step: ["goal", "plan"],
};

export const WORK_KINDS = ["goal", "plan", "step"] as const;
export type WorkKind = (typeof WORK_KINDS)[number];

export const WORK_STATUSES = ["open", "active", "blocked", "done", "dropped"] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

/** Work still worth showing someone. `done` and `dropped` are finished, in either direction. */
export const LIVE_STATUSES: WorkStatus[] = ["open", "active", "blocked"];

export const EXECUTION_STATUSES = [
  "proposed",
  "approved",
  "running",
  /** It ran, and stopped to ask the person something. Not a success and not a failure. */
  "needs_input",
  "done",
  "failed",
  "refused",
] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export type WorkRef = { type: string; id: string };

export type CreateWorkItemInput = {
  kind: WorkKind;
  title: string;
  detail?: string;
  reason?: string;
  status?: WorkStatus;
  parentId?: string | null;
  careerProfileId?: string | null;
  refs?: WorkRef[];
  dueAt?: Date | null;
  sortOrder?: number;
};

export type UpdateWorkItemInput = {
  title?: string;
  detail?: string;
  reason?: string;
  refs?: WorkRef[];
  dueAt?: Date | null;
  careerProfileId?: string | null;
  sortOrder?: number;
};

export type StartExecutionInput = {
  action: string;
  workItemId?: string | null;
  surface?: string;
  risk?: "read" | "write" | "external";
  status?: ExecutionStatus;
  receipt?: string;
  approvalId?: string | null;
};

export type FinishExecutionInput = {
  status: Extract<ExecutionStatus, "done" | "needs_input" | "failed" | "refused">;
  receipt?: string;
  error?: string | null;
};

export type RecordOutputInput = {
  workItemId: string;
  kind: string;
  refId: string;
  label?: string;
};

/**
 * The work kernel: what the person is trying to do, what was attempted, what came out.
 *
 * It holds ids and intent only. Career facts, documents and applications stay in their own
 * tables — a second place where the same truth lives is the bug this whole codebase is fighting.
 */
export function createWorkItemsRepository(db: DbOrTx) {
  async function own(userId: string, id: string): Promise<WorkItem | undefined> {
    const [row] = await db
      .select()
      .from(workItems)
      .where(and(eq(workItems.userId, userId), eq(workItems.id, id)))
      .limit(1);
    return row;
  }

  /** Every id under `rootId`, the root included. Used so a delete cannot orphan children. */
  async function descendantIds(userId: string, rootId: string): Promise<string[]> {
    const result = await db.execute<{ id: string }>(sql`
      WITH RECURSIVE tree AS (
        SELECT id FROM work_items WHERE user_id = ${userId} AND id = ${rootId}
        UNION ALL
        SELECT child.id
        FROM work_items child
        JOIN tree ON child.parent_id = tree.id
        WHERE child.user_id = ${userId}
      )
      SELECT id FROM tree
    `);
    return result.rows.map((row) => row.id);
  }

  async function nextSortOrder(userId: string, parentId: string | null): Promise<number> {
    const [row] = await db
      .select({ max: sql<number | null>`max(${workItems.sortOrder})` })
      .from(workItems)
      .where(
        and(
          eq(workItems.userId, userId),
          parentId === null ? isNull(workItems.parentId) : eq(workItems.parentId, parentId)
        )
      );
    return (row?.max ?? -1) + 1;
  }

  return {
    async create(userId: string, input: CreateWorkItemInput): Promise<WorkItem> {
      const title = input.title.trim();
      if (!title) throw new Error("Work needs a title.");

      const parentId = input.parentId ?? null;
      if (parentId) {
        const parent = await own(userId, parentId);
        if (!parent) throw new Error("Parent work item unavailable.");
        if (!ALLOWED_PARENTS[input.kind].includes(parent.kind as WorkKind)) {
          throw new Error(`A ${input.kind} cannot hang under a ${parent.kind}.`);
        }
      } else if (ALLOWED_PARENTS[input.kind].length > 0) {
        throw new Error(`A ${input.kind} needs a parent.`);
      }

      const [row] = await db
        .insert(workItems)
        .values({
          userId,
          kind: input.kind,
          title,
          detail: input.detail ?? "",
          reason: input.reason ?? "",
          status: input.status ?? "open",
          parentId,
          careerProfileId: input.careerProfileId ?? null,
          refs: input.refs ?? [],
          dueAt: input.dueAt ?? null,
          sortOrder: input.sortOrder ?? (await nextSortOrder(userId, parentId)),
        })
        .returning();
      return row;
    },

    async get(userId: string, id: string): Promise<WorkItem | undefined> {
      return own(userId, id);
    },

    /** Everything still live, newest goals first, children in their own order. */
    async listLive(userId: string): Promise<WorkItem[]> {
      return db
        .select()
        .from(workItems)
        .where(and(eq(workItems.userId, userId), inArray(workItems.status, LIVE_STATUSES)))
        .orderBy(asc(workItems.sortOrder), asc(workItems.createdAt));
    },

    /** The goals, the active one first. A person has one thing they are working towards. */
    async listGoals(userId: string, options: { includeFinished?: boolean } = {}) {
      return db
        .select()
        .from(workItems)
        .where(
          and(
            eq(workItems.userId, userId),
            eq(workItems.kind, "goal"),
            options.includeFinished ? undefined : inArray(workItems.status, LIVE_STATUSES)
          )
        )
        .orderBy(desc(eq(workItems.status, "active")), asc(workItems.sortOrder))
        .then((rows) => rows as WorkItem[]);
    },

    /**
     * Makes one goal the active one and stands every other goal down.
     *
     * Two people switching at once is not the risk; one person with two tabs is. A single
     * statement was not enough: two transactions that each saw no active goal both committed
     * one, and Today then led with a goal the person had switched away from. So this takes a
     * per-person lock first, and stands the old goal down BEFORE raising the new one — if it
     * dies in between, the person has no active goal, which the first screen can say, rather
     * than two, which it cannot.
     *
     * `work_items_one_active_goal_per_user` is the backstop: the lock only serialises callers
     * that take it, and a unique index binds every writer.
     */
    async setActiveGoal(userId: string, id: string): Promise<WorkItem> {
      await db.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`work-goal:${userId}`}, 0))`
      );

      const [owned] = await db
        .select()
        .from(workItems)
        .where(and(eq(workItems.userId, userId), eq(workItems.id, id), eq(workItems.kind, "goal")))
        .limit(1);
      if (!owned) throw new Error("Work item unavailable.");

      await db
        .update(workItems)
        .set({ status: "open", updatedAt: new Date() })
        .where(
          and(
            eq(workItems.userId, userId),
            eq(workItems.kind, "goal"),
            eq(workItems.status, "active"),
            ne(workItems.id, id)
          )
        );

      const [chosen] = await db
        .update(workItems)
        .set({ status: "active", updatedAt: new Date() })
        .where(and(eq(workItems.userId, userId), eq(workItems.id, id)))
        .returning();
      if (!chosen) throw new Error("Work item unavailable.");
      return chosen;
    },

    /** The goal the person is on, or nothing when they have not set one. */
    async activeGoal(userId: string): Promise<WorkItem | undefined> {
      const [row] = await db
        .select()
        .from(workItems)
        .where(
          and(
            eq(workItems.userId, userId),
            eq(workItems.kind, "goal"),
            eq(workItems.status, "active")
          )
        )
        .limit(1);
      return row;
    },

    async listChildren(userId: string, parentId: string): Promise<WorkItem[]> {
      return db
        .select()
        .from(workItems)
        .where(and(eq(workItems.userId, userId), eq(workItems.parentId, parentId)))
        .orderBy(asc(workItems.sortOrder), asc(workItems.createdAt));
    },

    /** A goal and everything beneath it, in one query, for a work-item thread or a plan view. */
    async tree(userId: string, rootId: string): Promise<WorkItem[]> {
      const ids = await descendantIds(userId, rootId);
      if (ids.length === 0) return [];
      return db
        .select()
        .from(workItems)
        .where(and(eq(workItems.userId, userId), inArray(workItems.id, ids)))
        .orderBy(asc(workItems.sortOrder), asc(workItems.createdAt));
    },

    /**
     * What Today asks for: the steps a person could actually do next.
     *
     * Overdue and dated work first, then undated, then insertion order. `blocked` is left out —
     * a step waiting on someone else is not an action, and offering it as one is a lie.
     */
    async nextActions(
      userId: string,
      options: { goalId?: string | null; limit?: number } = {}
    ): Promise<WorkItem[]> {
      // Scoped to one goal, because "what should I do next" is only true relative to what the
      // person said they are doing. Unscoped, switching goals left the same step on Today.
      let under: string[] | null = null;
      if (options.goalId) {
        under = await descendantIds(userId, options.goalId);
        if (under.length === 0) return [];
      }

      return db
        .select()
        .from(workItems)
        .where(
          and(
            eq(workItems.userId, userId),
            eq(workItems.kind, "step"),
            inArray(workItems.status, ["open", "active"]),
            under ? inArray(workItems.id, under) : undefined
          )
        )
        .orderBy(
          desc(eq(workItems.status, "active")),
          sql`${workItems.dueAt} asc nulls last`,
          asc(workItems.sortOrder),
          asc(workItems.createdAt)
        )
        .limit(options.limit ?? 5);
    },

    /** Live work that points at a given thing, so a job or document page can show its own work. */
    async listForRef(userId: string, ref: WorkRef): Promise<WorkItem[]> {
      return db
        .select()
        .from(workItems)
        .where(
          and(
            eq(workItems.userId, userId),
            sql`${workItems.refs} @> ${JSON.stringify([ref])}::jsonb`
          )
        )
        .orderBy(asc(workItems.sortOrder), asc(workItems.createdAt));
    },

    async update(userId: string, id: string, patch: UpdateWorkItemInput): Promise<WorkItem> {
      const title = patch.title?.trim();
      if (patch.title !== undefined && !title) throw new Error("Work needs a title.");

      const [row] = await db
        .update(workItems)
        .set({
          ...(title !== undefined ? { title } : {}),
          ...(patch.detail !== undefined ? { detail: patch.detail } : {}),
          ...(patch.reason !== undefined ? { reason: patch.reason } : {}),
          ...(patch.refs !== undefined ? { refs: patch.refs } : {}),
          ...(patch.dueAt !== undefined ? { dueAt: patch.dueAt } : {}),
          ...(patch.careerProfileId !== undefined
            ? { careerProfileId: patch.careerProfileId }
            : {}),
          ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(workItems.userId, userId), eq(workItems.id, id)))
        .returning();
      if (!row) throw new Error("Work item unavailable.");
      return row;
    },

    /**
     * Move work through its statuses. `completedAt` follows the status both ways, so reopening
     * something does not leave a completion date behind claiming it was finished.
     */
    async setStatus(
      userId: string,
      id: string,
      status: WorkStatus,
      options: { reason?: string } = {}
    ): Promise<WorkItem> {
      const finished = status === "done" || status === "dropped";
      const [row] = await db
        .update(workItems)
        .set({
          status,
          completedAt: finished ? new Date() : null,
          ...(options.reason !== undefined ? { reason: options.reason } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(workItems.userId, userId), eq(workItems.id, id)))
        .returning();
      if (!row) throw new Error("Work item unavailable.");
      return row;
    },

    /**
     * Deletes the item and everything under it.
     *
     * What was SAID about the work is not the work's to take with it. Before the rows go, each
     * message is returned to the general conversation and stamped with what the work was
     * called — otherwise the turns keep a dead id, disappear from general history and become
     * unreachable by any screen. Receipts survive too: `work_executions` keeps its own copy of
     * the label and its pointer is set null, so the account of what Fadi did outlives a delete.
     */
    async remove(userId: string, id: string): Promise<number> {
      const items = await db
        .select({ id: workItems.id, title: workItems.title })
        .from(workItems)
        .where(
          and(eq(workItems.userId, userId), inArray(workItems.id, await descendantIds(userId, id)))
        );
      if (items.length === 0) return 0;

      for (const item of items) {
        await db
          .update(agentMessages)
          .set({
            workItemId: null,
            metadata: sql`${agentMessages.metadata} || ${JSON.stringify({ formerWork: item.title })}::jsonb`,
            updatedAt: new Date(),
          })
          .where(and(eq(agentMessages.userId, userId), eq(agentMessages.workItemId, item.id)));
      }

      const rows = await db
        .delete(workItems)
        .where(
          and(
            eq(workItems.userId, userId),
            inArray(
              workItems.id,
              items.map((item) => item.id)
            )
          )
        )
        .returning({ id: workItems.id });
      return rows.length;
    },

    /** Records the attempt before it runs, so a crash still leaves a trace of what was tried. */
    async startExecution(userId: string, input: StartExecutionInput): Promise<WorkExecution> {
      const item = input.workItemId ? await own(userId, input.workItemId) : undefined;
      if (input.workItemId && !item) throw new Error("Work item unavailable.");
      const [row] = await db
        .insert(workExecutions)
        .values({
          userId,
          workItemId: input.workItemId ?? null,
          workLabel: item?.title ?? "",
          action: input.action,
          surface: input.surface ?? "web",
          risk: input.risk ?? "read",
          status: input.status ?? "running",
          receipt: input.receipt ?? "",
          approvalId: input.approvalId ?? null,
        })
        .returning();
      return row;
    },

    async finishExecution(
      userId: string,
      executionId: string,
      input: FinishExecutionInput
    ): Promise<WorkExecution> {
      const [row] = await db
        .update(workExecutions)
        .set({
          status: input.status,
          ...(input.receipt !== undefined ? { receipt: input.receipt } : {}),
          error: input.error ?? null,
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(workExecutions.userId, userId), eq(workExecutions.id, executionId)))
        .returning();
      if (!row) throw new Error("Execution unavailable.");
      return row;
    },

    /** The receipts Today shows under "what Fadi did", newest first. */
    async listExecutions(
      userId: string,
      options: { workItemId?: string; limit?: number } = {}
    ): Promise<WorkExecution[]> {
      return db
        .select()
        .from(workExecutions)
        .where(
          and(
            eq(workExecutions.userId, userId),
            options.workItemId ? eq(workExecutions.workItemId, options.workItemId) : undefined
          )
        )
        .orderBy(desc(workExecutions.startedAt))
        .limit(options.limit ?? 20);
    },

    /**
     * Ties a thing that already exists to the work that produced it. Repeating the same tie is
     * not an error — a step run twice should not create a second claim to one document.
     */
    async recordOutput(userId: string, input: RecordOutputInput): Promise<WorkOutput> {
      if (!(await own(userId, input.workItemId))) throw new Error("Work item unavailable.");
      const [row] = await db
        .insert(workOutputs)
        .values({
          userId,
          workItemId: input.workItemId,
          kind: input.kind,
          refId: input.refId,
          label: input.label ?? "",
        })
        .onConflictDoUpdate({
          target: [workOutputs.workItemId, workOutputs.kind, workOutputs.refId],
          set: { label: input.label ?? "", updatedAt: new Date() },
        })
        .returning();
      return row;
    },

    async listOutputs(
      userId: string,
      options: { workItemId?: string; kind?: string } = {}
    ): Promise<WorkOutput[]> {
      return db
        .select()
        .from(workOutputs)
        .where(
          and(
            eq(workOutputs.userId, userId),
            options.workItemId ? eq(workOutputs.workItemId, options.workItemId) : undefined,
            options.kind ? eq(workOutputs.kind, options.kind) : undefined
          )
        )
        .orderBy(desc(workOutputs.createdAt));
    },
  };
}

export type WorkItemsRepository = ReturnType<typeof createWorkItemsRepository>;
