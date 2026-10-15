import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * A project's earlier plans are kept and can come back. The owner's question (15 Oct 2026):
 * "midway I restart the project, see different steps, but I wanted the previous ones".
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("earlier plans", () => {
  let pool: import("pg").Pool;
  let repo: ReturnType<typeof import("@careeros/database").createProjectRunsRepository>;
  let userId: string;
  let otherId: string;
  let runId: string;

  const step = (ordinal: number, title: string) => ({
    ordinal,
    title,
    instruction: `Do ${title}.`,
    verify: null,
    produces: null,
  });

  beforeAll(async () => {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { createProjectRunsRepository } = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    repo = createProjectRunsRepository(drizzle(pool) as never);
    const user = async (tag: string) =>
      (
        await pool.query("insert into users (email) values ($1) returning id", [
          `${tag}-${Date.now()}@example.test`,
        ])
      ).rows[0].id as string;
    userId = await user("plans");
    otherId = await user("plans-other");
    runId = (
      await repo.createWithSteps(userId, { title: "SIEM for an SME" }, [
        step(1, "Open the lab"),
        step(2, "Install the agent by hand"),
        step(3, "Write a rule"),
      ])
    ).run.id;
  });

  afterAll(async () => {
    await pool?.query("delete from users where id = any($1)", [[userId, otherId]]);
    await pool?.end();
  });

  it("keeps the old plan, with its progress, when the project is started over", async () => {
    const [first] = (await repo.getWithSteps(userId, runId))!.steps;
    await repo.setStepStatus(userId, first!.id, { status: "done", artifact: "C:\\Lab created" });

    await repo.replaceSteps(userId, runId, [step(1, "Use the SIEM stack"), step(2, "Enrol")], {
      keepDone: false,
    });
    const now = (await repo.getWithSteps(userId, runId))!.steps;
    expect(now.map((s) => s.title)).toEqual(["Use the SIEM stack", "Enrol"]);

    const [kept] = await repo.listPlanVersions(userId, runId);
    expect(kept).toMatchObject({ version: 1, reason: "started_over" });
    expect(kept!.steps.map((s) => s.title)).toEqual([
      "Open the lab",
      "Install the agent by hand",
      "Write a rule",
    ]);
    expect(kept!.steps[0]).toMatchObject({ status: "done", artifact: "C:\\Lab created" });
  });

  it("keeps a step as it was written before Fadi corrects it", async () => {
    const open = (await repo.getWithSteps(userId, runId))!.steps[0]!;
    await repo.reviseOpenStep(userId, open.id, { instruction: "Corrected instruction." });
    const [latest] = await repo.listPlanVersions(userId, runId);
    expect(latest).toMatchObject({ version: 2, reason: "step_revised" });
    expect(latest!.steps[0]!.instruction).toBe("Do Use the SIEM stack.");
  });

  it("brings the earlier plan back exactly, and keeps the one it replaces", async () => {
    const original = (await repo.listPlanVersions(userId, runId)).find((v) => v.version === 1)!;
    const restored = await repo.restorePlanVersion(userId, runId, original.id);
    expect(restored).toEqual({ steps: 3 });

    const steps = (await repo.getWithSteps(userId, runId))!.steps;
    expect(steps.map((s) => s.title)).toEqual([
      "Open the lab",
      "Install the agent by hand",
      "Write a rule",
    ]);
    expect(steps[0]).toMatchObject({ status: "done", artifact: "C:\\Lab created" });

    const [latest] = await repo.listPlanVersions(userId, runId);
    expect(latest).toMatchObject({ version: 3, reason: "restored_other" });
    expect(latest!.steps[0]!.instruction).toBe("Corrected instruction.");
  });

  it("never shows or restores another person's plans", async () => {
    expect(await repo.listPlanVersions(otherId, runId)).toEqual([]);
    const [any] = await repo.listPlanVersions(userId, runId);
    expect(await repo.restorePlanVersion(otherId, runId, any!.id)).toBeNull();
  });

  it("a fresh start clears steps and earlier plans, and touches nobody else's", async () => {
    expect(await repo.resetProgress(otherId, runId)).toBe(false);
    expect((await repo.getWithSteps(userId, runId))!.steps.length).toBeGreaterThan(0);

    expect(await repo.resetProgress(userId, runId)).toBe(true);
    const after = (await repo.getWithSteps(userId, runId))!;
    expect(after.steps).toEqual([]);
    expect(after.run.status).toBe("running");
    expect(await repo.listPlanVersions(userId, runId)).toEqual([]);
  });
});
