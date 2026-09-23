import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("Work kernel", () => {
  let pool: import("pg").Pool;
  let repo: import("@careeros/database").WorkItemsRepository;
  let userId: string;
  let strangerId: string;

  beforeAll(async () => {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { createWorkItemsRepository } = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    const stamp = Date.now();
    userId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `work-${stamp}@example.test`,
      ])
    ).rows[0].id;
    strangerId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `work-other-${stamp}@example.test`,
      ])
    ).rows[0].id;
    repo = createWorkItemsRepository(drizzle(pool) as never);
  });

  afterAll(async () => {
    if (userId) await pool.query("delete from users where id = any($1)", [[userId, strangerId]]);
    await pool?.end();
  });

  it("only lets work hang where it belongs", async () => {
    const goal = await repo.create(userId, { kind: "goal", title: "Land a cloud role" });
    const plan = await repo.create(userId, {
      kind: "plan",
      title: "Apply to five Dublin teams",
      parentId: goal.id,
    });
    const step = await repo.create(userId, {
      kind: "step",
      title: "Tailor the CV for Stripe",
      parentId: plan.id,
    });

    expect(step.parentId).toBe(plan.id);
    await expect(repo.create(userId, { kind: "plan", title: "Orphan plan" })).rejects.toThrow(
      /needs a parent/
    );
    await expect(
      repo.create(userId, { kind: "step", title: "Step under a step", parentId: step.id })
    ).rejects.toThrow(/cannot hang under/);
    await expect(
      repo.create(userId, { kind: "goal", title: "Goal with a parent", parentId: goal.id })
    ).rejects.toThrow(/cannot hang under/);

    await repo.remove(userId, goal.id);
  });

  it("refuses to attach work to someone else's goal", async () => {
    const theirs = await repo.create(strangerId, { kind: "goal", title: "Their goal" });

    await expect(
      repo.create(userId, { kind: "plan", title: "Borrowed plan", parentId: theirs.id })
    ).rejects.toThrow(/unavailable/);
    expect(await repo.get(userId, theirs.id)).toBeUndefined();
    await expect(repo.update(userId, theirs.id, { title: "Renamed" })).rejects.toThrow(
      /unavailable/
    );
    expect(await repo.remove(userId, theirs.id)).toBe(0);

    await repo.remove(strangerId, theirs.id);
  });

  it("offers as next actions only the steps a person could actually do", async () => {
    const goal = await repo.create(userId, { kind: "goal", title: "This week" });
    const soon = new Date(Date.now() + 60_000);
    const later = new Date(Date.now() + 86_400_000);

    const dueLater = await repo.create(userId, {
      kind: "step",
      title: "Later",
      parentId: goal.id,
      dueAt: later,
    });
    const dueSoon = await repo.create(userId, {
      kind: "step",
      title: "Soon",
      parentId: goal.id,
      dueAt: soon,
    });
    const undated = await repo.create(userId, {
      kind: "step",
      title: "Undated",
      parentId: goal.id,
    });
    const waiting = await repo.create(userId, {
      kind: "step",
      title: "Waiting on a reply",
      parentId: goal.id,
      status: "blocked",
    });
    const finished = await repo.create(userId, {
      kind: "step",
      title: "Already sent",
      parentId: goal.id,
      status: "done",
    });

    const actions = await repo.nextActions(userId, 10);
    const ids = actions.map((row) => row.id);

    expect(ids).toEqual([dueSoon.id, dueLater.id, undated.id]);
    expect(ids).not.toContain(waiting.id);
    expect(ids).not.toContain(finished.id);
    expect(ids).not.toContain(goal.id);

    // Work in progress comes before anything not yet started.
    await repo.setStatus(userId, undated.id, "active");
    expect((await repo.nextActions(userId, 1))[0]!.id).toBe(undated.id);

    await repo.remove(userId, goal.id);
  });

  it("keeps a completion date honest when work is reopened", async () => {
    const goal = await repo.create(userId, { kind: "goal", title: "Reopen me" });

    const done = await repo.setStatus(userId, goal.id, "done");
    expect(done.completedAt).toBeInstanceOf(Date);

    const reopened = await repo.setStatus(userId, goal.id, "active");
    expect(reopened.completedAt).toBeNull();

    const dropped = await repo.setStatus(userId, goal.id, "dropped", {
      reason: "The role was filled.",
    });
    expect(dropped.completedAt).toBeInstanceOf(Date);
    expect(dropped.reason).toBe("The role was filled.");

    await repo.remove(userId, goal.id);
  });

  it("takes the whole branch down with a goal, receipts and outputs included", async () => {
    const goal = await repo.create(userId, { kind: "goal", title: "Branch" });
    const plan = await repo.create(userId, {
      kind: "plan",
      title: "Branch plan",
      parentId: goal.id,
    });
    const step = await repo.create(userId, {
      kind: "step",
      title: "Branch step",
      parentId: plan.id,
    });

    const execution = await repo.startExecution(userId, {
      action: "Draft a cover letter",
      workItemId: step.id,
      risk: "write",
    });
    await repo.recordOutput(userId, {
      workItemId: step.id,
      kind: "document",
      refId: "doc-1",
      label: "Cover letter",
    });

    expect(await repo.tree(userId, goal.id)).toHaveLength(3);
    expect(await repo.remove(userId, goal.id)).toBe(3);

    const orphans = await pool.query(
      "select id from work_items where user_id = $1 and id = any($2)",
      [userId, [goal.id, plan.id, step.id]]
    );
    expect(orphans.rowCount).toBe(0);

    const receipts = await pool.query("select id from work_executions where id = $1", [
      execution.id,
    ]);
    expect(receipts.rowCount).toBe(0);

    const outputs = await pool.query("select id from work_outputs where work_item_id = $1", [
      step.id,
    ]);
    expect(outputs.rowCount).toBe(0);
  });

  it("does not let one thing be claimed twice by the same step", async () => {
    const goal = await repo.create(userId, { kind: "goal", title: "Outputs" });
    const step = await repo.create(userId, {
      kind: "step",
      title: "Write it",
      parentId: goal.id,
    });

    const first = await repo.recordOutput(userId, {
      workItemId: step.id,
      kind: "document",
      refId: "doc-42",
      label: "Draft",
    });
    const again = await repo.recordOutput(userId, {
      workItemId: step.id,
      kind: "document",
      refId: "doc-42",
      label: "Final",
    });

    expect(again.id).toBe(first.id);
    expect(again.label).toBe("Final");
    expect(await repo.listOutputs(userId, { workItemId: step.id })).toHaveLength(1);

    await expect(
      repo.recordOutput(strangerId, { workItemId: step.id, kind: "document", refId: "doc-42" })
    ).rejects.toThrow(/unavailable/);

    await repo.remove(userId, goal.id);
  });

  it("leaves a receipt for what was attempted, however it ended", async () => {
    const goal = await repo.create(userId, { kind: "goal", title: "Receipts" });
    const step = await repo.create(userId, { kind: "step", title: "Try", parentId: goal.id });

    const started = await repo.startExecution(userId, {
      action: "Search Dublin jobs",
      workItemId: step.id,
      surface: "background",
    });
    expect(started.status).toBe("running");
    expect(started.finishedAt).toBeNull();

    const failed = await repo.finishExecution(userId, started.id, {
      status: "failed",
      receipt: "The search engine refused the request.",
      error: "429",
    });
    expect(failed.status).toBe("failed");
    expect(failed.finishedAt).toBeInstanceOf(Date);
    expect(failed.receipt).toBe("The search engine refused the request.");

    await expect(
      repo.startExecution(userId, {
        action: "Borrowed",
        workItemId: (await repo.create(strangerId, { kind: "goal", title: "Theirs" })).id,
      })
    ).rejects.toThrow(/unavailable/);

    await expect(repo.finishExecution(strangerId, started.id, { status: "done" })).rejects.toThrow(
      /unavailable/
    );

    expect(await repo.listExecutions(userId, { workItemId: step.id })).toHaveLength(1);

    await repo.remove(userId, goal.id);
  });

  it("finds the work that points at a job", async () => {
    const goal = await repo.create(userId, {
      kind: "goal",
      title: "Stripe",
      refs: [{ type: "job", id: "job-7" }],
    });
    const other = await repo.create(userId, {
      kind: "goal",
      title: "Elsewhere",
      refs: [{ type: "job", id: "job-8" }],
    });

    const found = await repo.listForRef(userId, { type: "job", id: "job-7" });
    expect(found.map((row) => row.id)).toEqual([goal.id]);
    expect(await repo.listForRef(strangerId, { type: "job", id: "job-7" })).toHaveLength(0);

    await repo.remove(userId, goal.id);
    await repo.remove(userId, other.id);
  });
});
