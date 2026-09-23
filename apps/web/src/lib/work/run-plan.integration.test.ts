import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The plan is the thing that replaces a chat window, so what it must never do is claim a step
 * happened. These drive it against a real database with the capabilities stubbed at the one
 * door every call goes through.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

const holder = vi.hoisted(() => ({
  db: null as unknown,
  calls: [] as Array<{ name: string; args: Record<string, unknown>; workItemId?: string | null }>,
  reply: { summary: "Done.", outcome: "performed" } as Record<string, unknown>,
}));

vi.mock("@/lib/database/client", () => ({ getDatabase: () => holder.db }));
vi.mock("@/lib/ai/user-generate", () => ({ getUserDocGenerate: async () => ({}) }));
vi.mock("@/lib/ai/tools/registry", () => ({
  executeFadiTool: async (
    name: string,
    args: Record<string, unknown>,
    ctx: { workItemId?: string | null }
  ) => {
    holder.calls.push({ name, args, workItemId: ctx.workItemId });
    return holder.reply;
  },
}));

suite("running a plan", () => {
  let pool: import("pg").Pool;
  let work: import("@careeros/database").WorkItemsRepository;
  let plans: typeof import("./run-plan");
  let userId: string;
  let jobId: string;

  beforeAll(async () => {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { createJobsRepository, createWorkItemsRepository } = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    userId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `plan-${Date.now()}@example.test`,
      ])
    ).rows[0].id;
    holder.db = drizzle(pool) as never;
    work = createWorkItemsRepository(holder.db as never);

    const job = await createJobsRepository(holder.db as never).upsertSeedJob({
      source: "reed",
      externalId: `plan-${Date.now()}`,
      title: "Service Desk Engineer",
      company: "Version 1",
      location: "Dublin",
      description: "Support role in Dublin.",
      url: "https://example.test/apply/1",
    });
    jobId = job.id;
    plans = await import("./run-plan");
  });

  afterAll(async () => {
    if (userId) await pool.query("delete from users where id = $1", [userId]);
    await pool?.end();
  });

  async function freshGoal(title: string) {
    await pool.query("delete from work_items where user_id = $1", [userId]);
    const goal = await work.create(userId, { kind: "goal", title });
    await work.setActiveGoal(userId, goal.id);
    holder.calls.length = 0;
    holder.reply = { summary: "Done.", outcome: "performed" };
    return goal;
  }

  it("refuses to start work with no goal to serve", async () => {
    await pool.query("delete from work_items where user_id = $1", [userId]);
    const started = await plans.startPlan(userId, "apply-to-role", [{ type: "job", id: jobId }]);

    expect(started.ok).toBe(false);
    expect(await work.listLive(userId)).toHaveLength(0);
  });

  it("writes the plan out in full before doing any of it", async () => {
    await freshGoal("Land a support role");
    const started = await plans.startPlan(userId, "apply-to-role", [{ type: "job", id: jobId }]);
    expect(started.ok).toBe(true);

    const plan = (await plans.runningPlan(userId))!;
    expect(plan.title).toBe("Apply to Version 1 — Service Desk Engineer");

    const steps = await plans.planSteps(userId, plan.id);
    expect(steps.map((step) => step.title)).toEqual([
      "Check the posting is still open",
      "Check whether you are a fit",
      "Tailor your CV to this role",
      "Draft the message that goes with it",
      "Read it, then send it",
      "Record that you applied",
    ]);
    // Creating a plan runs nothing. A job card must not start drafting in someone's name.
    expect(holder.calls).toHaveLength(0);
    expect(steps.every((step) => step.status === "open")).toBe(true);
  });

  it("does one step per call, with the arguments computed from the plan's own job", async () => {
    await freshGoal("One at a time");
    const { planId } = (await plans.startPlan(userId, "apply-to-role", [
      { type: "job", id: jobId },
    ])) as { ok: true; planId: string };

    const first = await plans.advancePlan(userId, planId);
    expect(first.state).toBe("ran");
    expect(holder.calls).toHaveLength(1);
    expect(holder.calls[0]!.name).toBe("check_posting_open");
    expect(holder.calls[0]!.args).toEqual({ jobId });
    // The receipt belongs to the step, not to the plan or to nothing.
    expect(holder.calls[0]!.workItemId).toBe(
      (await plans.planSteps(userId, planId))[0]!.id
    );

    // What the step found is kept on the step, so a read that leaves no receipt still tells
    // the person the answer rather than only that it ran.
    expect((await plans.planSteps(userId, planId))[0]!.detail).toBe("Done.");

    const second = await plans.advancePlan(userId, planId);
    expect(second.state).toBe("ran");
    expect(holder.calls[1]!.name).toBe("evaluate_fit");
    expect(holder.calls[1]!.args).toMatchObject({
      jobTitle: "Service Desk Engineer",
      company: "Version 1",
      jobDescription: "Support role in Dublin.",
    });
  });

  it("stops at the step that is the person's, instead of skipping to an easier one", async () => {
    await freshGoal("Wait for me");
    const { planId } = (await plans.startPlan(userId, "apply-to-role", [
      { type: "job", id: jobId },
    ])) as { ok: true; planId: string };

    for (let i = 0; i < 4; i += 1) expect((await plans.advancePlan(userId, planId)).state).toBe("ran");

    const waiting = await plans.advancePlan(userId, planId);
    expect(waiting.state).toBe("waiting");
    expect(waiting.state === "waiting" && waiting.step.title).toBe("Read it, then send it");
    // Four capability calls, and nothing reached "Record that you applied" behind their back.
    expect(holder.calls).toHaveLength(4);
    expect(holder.calls.map((call) => call.name)).not.toContain("track_application");
  });

  it("does not tick off a step a capability refused to do", async () => {
    await freshGoal("Honest about stopping");
    const { planId } = (await plans.startPlan(userId, "apply-to-role", [
      { type: "job", id: jobId },
    ])) as { ok: true; planId: string };

    holder.reply = { summary: "That posting has closed.", outcome: "refused" };
    const outcome = await plans.advancePlan(userId, planId);

    expect(outcome.state).toBe("stopped");
    const [first] = await plans.planSteps(userId, planId);
    expect(first!.status).toBe("blocked");
    expect(first!.reason).toBe("That posting has closed.");

    // And it stays stopped there rather than wandering on to the next step.
    holder.calls.length = 0;
    const again = await plans.advancePlan(userId, planId);
    expect(again.state).toBe("stopped");
    expect(holder.calls).toHaveLength(0);
  });

  it("finishes the plan when its steps are done", async () => {
    await freshGoal("All the way");
    const { planId } = (await plans.startPlan(userId, "apply-to-role", [
      { type: "job", id: jobId },
    ])) as { ok: true; planId: string };

    const steps = await plans.planSteps(userId, planId);
    for (const step of steps) await work.setStatus(userId, step.id, "done");

    expect((await plans.advancePlan(userId, planId)).state).toBe("finished");
    expect((await work.get(userId, planId))!.status).toBe("done");
    expect(await plans.runningPlan(userId)).toBeUndefined();
  });
});
