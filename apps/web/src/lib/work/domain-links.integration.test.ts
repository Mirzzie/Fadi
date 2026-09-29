import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("Domain links into the work kernel", () => {
  let pool: import("pg").Pool;
  let db: import("@careeros/database").Database;
  let work: import("@careeros/database").WorkItemsRepository;
  let userId: string;

  beforeAll(async () => {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { createWorkItemsRepository } = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    db = drizzle(pool) as never;
    userId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `domain-links-${Date.now()}@example.test`,
      ])
    ).rows[0].id;
    work = createWorkItemsRepository(db);
  });

  afterAll(async () => {
    if (userId) await pool.query("delete from users where id = $1", [userId]);
    await pool?.end();
  });

  it("attaches an application to its apply plan and closes the plan when sent", async () => {
    const { createApplicationsRepository } = await import("@careeros/database");
    const { linkApplicationToWork } = await import("./domain-links");
    const goal = await work.create(userId, {
      kind: "goal",
      title: "Land a security role",
      status: "active",
    });
    const job = (
      await pool.query(
        "insert into jobs (source, external_id, canonical_key, title, company) values ('test', $1, $1, 'AppSec Engineer', 'Intercom') returning id",
        [`job-${Date.now()}`]
      )
    ).rows[0];
    const plan = await work.create(userId, {
      kind: "plan",
      title: "Apply to Intercom",
      parentId: goal.id,
      status: "active",
      refs: [
        { type: "template", id: "apply-to-role" },
        { type: "job", id: job.id },
      ],
    });
    const apps = createApplicationsRepository(db);
    const application = await apps.createForUser(userId, {
      jobId: job.id,
      company: "Intercom",
      title: "AppSec Engineer",
      status: "interested",
    });

    const linked = await linkApplicationToWork(db, userId, application);
    expect(linked?.id).toBe(plan.id);
    expect(linked?.refs[0]).toEqual({ type: "application_workspace", id: job.id });
    expect(
      await work.listOutputs(userId, { workItemId: plan.id, kind: "application" })
    ).toHaveLength(1);

    const applied = await apps.updateForUser(userId, application.id, { status: "applied" });
    await linkApplicationToWork(db, userId, applied!);
    expect((await work.get(userId, plan.id))?.status).toBe("done");
  });

  it("gives a project run one next action under the active goal", async () => {
    const { createProjectRunsRepository } = await import("@careeros/database");
    const { linkProjectRunToWork } = await import("./domain-links");
    const goal = await work.activeGoal(userId);
    expect(goal).toBeDefined();
    const runs = createProjectRunsRepository(db);
    const { run, steps } = await runs.createWithSteps(userId, { title: "Threat-model an API" }, [
      { ordinal: 1, title: "Map trust boundaries", instruction: "Draw the data flow." },
    ]);

    const first = await linkProjectRunToWork(db, userId, run);
    const repeated = await linkProjectRunToWork(db, userId, run);

    expect(first?.id).toBe(repeated?.id);
    expect(first?.parentId).toBe(goal!.id);
    expect(first?.status).toBe("active");
    expect(first?.refs).toContainEqual({ type: "project_run", id: run.id });
    expect(
      await work.listOutputs(userId, { workItemId: first!.id, kind: "project_run" })
    ).toHaveLength(1);

    await runs.setStepStatus(userId, steps[0].id, { status: "done" });
    expect((await work.get(userId, first!.id))?.status).toBe("done");

    await runs.setStepStatus(userId, steps[0].id, { status: "pending" });
    expect((await work.get(userId, first!.id))?.status).toBe("active");

    await runs.abandon(userId, run.id);
    expect((await work.get(userId, first!.id))?.status).toBe("dropped");

    expect(await runs.remove(userId, run.id)).toBe(true);
    expect(await work.get(userId, first!.id)).toBeUndefined();
  });
});
