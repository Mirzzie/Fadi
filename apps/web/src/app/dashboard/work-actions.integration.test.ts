import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * A server action is a network entry point. These tests call them the way a forged request
 * would: with values the UI never sends.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

const holder = vi.hoisted(() => ({ db: null as unknown, userId: "" }));
vi.mock("@/lib/database/client", () => ({ getDatabase: () => holder.db }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentAuthUser: async () => ({ id: holder.userId, email: "actions@example.test" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

suite("Today's server actions", () => {
  let pool: import("pg").Pool;
  let work: import("@careeros/database").WorkItemsRepository;
  let actions: typeof import("./work-actions");

  beforeAll(async () => {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { createWorkItemsRepository } = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    holder.userId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `actions-${Date.now()}@example.test`,
      ])
    ).rows[0].id;
    holder.db = drizzle(pool) as never;
    work = createWorkItemsRepository(holder.db as never);
    actions = await import("./work-actions");
  });

  afterAll(async () => {
    if (holder.userId) await pool.query("delete from users where id = $1", [holder.userId]);
    await pool?.end();
  });

  it("creates a goal and makes it the one you are on, or neither", async () => {
    expect(await actions.setGoalAction("Land a cloud role")).toEqual({ ok: true });

    const goals = await work.listGoals(holder.userId);
    expect(goals).toHaveLength(1);
    expect(goals[0]!.status).toBe("active");

    expect((await actions.setGoalAction("   ")).ok).toBe(false);
    expect(await work.listGoals(holder.userId)).toHaveLength(1);
  });

  it("refuses a status the state machine does not have", async () => {
    const goal = (await work.listGoals(holder.userId))[0]!;
    const step = await work.create(holder.userId, {
      kind: "step",
      title: "A step",
      parentId: goal.id,
    });

    // The UI only ever sends these. The wire can send anything.
    const forged = await actions.setStepStatusAction(step.id, "deleted-by-me");
    expect(forged.ok).toBe(false);
    expect((await work.get(holder.userId, step.id))!.status).toBe("open");

    expect(await actions.setStepStatusAction(step.id, "done")).toEqual({ ok: true });
    expect((await work.get(holder.userId, step.id))!.status).toBe("done");
  });

  it("will not let the step action move a goal", async () => {
    const goal = (await work.listGoals(holder.userId))[0]!;
    const result = await actions.setStepStatusAction(goal.id, "dropped");

    expect(result.ok).toBe(false);
    expect((await work.get(holder.userId, goal.id))!.status).toBe("active");
  });

  it("refuses an id that is not an id, and one that is not yours", async () => {
    expect((await actions.setStepStatusAction("not-a-uuid", "done")).ok).toBe(false);
    expect((await actions.switchGoalAction("not-a-uuid")).ok).toBe(false);

    const stranger = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `stranger-${Date.now()}@example.test`,
      ])
    ).rows[0].id;
    const theirs = await work.create(stranger, { kind: "goal", title: "Theirs" });

    expect((await actions.switchGoalAction(theirs.id)).ok).toBe(false);
    expect((await actions.setStepStatusAction(theirs.id, "done")).ok).toBe(false);
    expect((await work.get(stranger, theirs.id))!.status).toBe("open");

    await pool.query("delete from users where id = $1", [stranger]);
  });

  it("will not hang a step under nothing", async () => {
    await pool.query("delete from work_items where user_id = $1", [holder.userId]);
    const result = await actions.addStepAction("An orphan step");

    expect(result).toEqual({ ok: false, error: "Name what you are working towards first." });
    expect(await work.listLive(holder.userId)).toHaveLength(0);
  });
});
