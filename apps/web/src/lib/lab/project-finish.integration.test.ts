import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * A PROJECT FINISHES, AND ITS EVIDENCE IS SAVED ONCE — against a real database.
 *
 * Every step of a project could be done while the run stayed "running" forever, so nothing
 * downstream ever started. And a save that is only guarded in application code admits the same
 * project twice when two requests arrive together. Both are properties of the transaction, which
 * a mocked repository cannot show.
 *
 * Requires FADI_TEST_DATABASE_URL pointed at a database this may modify.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("finishing a project", () => {
  let pool: import("pg").Pool;
  let runs: ReturnType<typeof import("@careeros/database").createProjectRunsRepository>;
  let evidence: typeof import("@careeros/database").createEvidenceRepository;
  let userId: string;

  beforeAll(async () => {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const db = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    runs = db.createProjectRunsRepository(drizzle(pool) as never);
    evidence = db.createEvidenceRepository;
    const { rows } = await pool.query(`insert into users (email) values ($1) returning id`, [
      `finish-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
    ]);
    userId = rows[0].id as string;
  }, 60_000);

  afterAll(async () => {
    if (userId) await pool.query(`delete from users where id = $1`, [userId]);
    await pool?.end();
  });

  const plan = () =>
    runs.createWithSteps(userId, { title: "Harden nginx" }, [
      { ordinal: 1, title: "Install", instruction: "apk add nginx" },
      { ordinal: 2, title: "Configure", instruction: "edit nginx.conf" },
    ]);

  const status = async (runId: string) =>
    (await pool.query(`select status, completed_at from project_runs where id = $1`, [runId])).rows[0];

  it("the run is done only when every step is done, and reopening a step reopens it", async () => {
    const { run, steps } = await plan();
    await runs.setStepStatus(userId, steps[0].id, { status: "done" });
    expect((await status(run.id)).status).not.toBe("done");

    await runs.setStepStatus(userId, steps[1].id, { status: "done", artifact: "nginx -t ok" });
    const finished = await status(run.id);
    expect(finished.status).toBe("done");
    expect(finished.completed_at).not.toBeNull();

    await runs.setStepStatus(userId, steps[1].id, { status: "pending" });
    const reopened = await status(run.id);
    expect(reopened.status).toBe("running");
    expect(reopened.completed_at).toBeNull();
  });

  it("a run finished before completion was decided centrally is settled on read", async () => {
    const { run, steps } = await plan();
    await pool.query(`update project_steps set status = 'done' where run_id = $1`, [run.id]);
    expect((await status(run.id)).status).not.toBe("done");
    await runs.settle(userId, run.id);
    expect((await status(run.id)).status).toBe("done");
    expect(steps.length).toBe(2);
  });

  it("replanning keeps finished steps and their results, and continues numbering after them", async () => {
    const { run, steps } = await plan();
    await runs.setStepStatus(userId, steps[0].id, {
      status: "done",
      artifact: "nginx installed",
      completion: "evidenced",
    });

    const replaced = await runs.replaceSteps(userId, run.id, [
      { ordinal: 1, title: "Configure TLS properly", instruction: "openssl req" },
      { ordinal: 2, title: "Check headers", instruction: "curl -I" },
    ]);
    expect(replaced?.kept.map((s) => s.id)).toEqual([steps[0].id]);

    const after = await runs.getWithSteps(userId, run.id);
    expect(after?.steps.map((s) => [s.ordinal, s.title, s.status])).toEqual([
      [1, "Install", "done"],
      [2, "Configure TLS properly", "pending"],
      [3, "Check headers", "pending"],
    ]);
    expect(after?.steps[0].artifact).toBe("nginx installed");
    expect(after?.steps[0].completion).toBe("evidenced");
    expect((await status(run.id)).status).not.toBe("done");
  });

  it("a skipped step is not a met requirement", async () => {
    const { run, steps } = await plan();
    await runs.setStepStatus(userId, steps[0].id, { status: "done" });
    await runs.setStepStatus(userId, steps[1].id, { status: "skipped" });
    expect((await status(run.id)).status).not.toBe("done");
  });

  it("an unfinished project cannot be saved as evidence", async () => {
    const { run } = await plan();
    let called = false;
    const result = await runs.saveEvidenceOnce(userId, run.id, async () => {
      called = true;
      return { id: "never" };
    });
    expect(result.status).toBe("not_finished");
    expect(called).toBe(false);
  });

  it("two saves at the same time create ONE evidence item", async () => {
    const { run, steps } = await plan();
    for (const step of steps) await runs.setStepStatus(userId, step.id, { status: "done" });

    let creates = 0;
    const save = () =>
      runs.saveEvidenceOnce(userId, run.id, async (tx) => {
        creates++;
        return evidence(tx).create(userId, {
          kind: "project",
          title: "Harden nginx",
          detail: "Installed and configured nginx in a lab.",
          origin: "learning",
        } as never);
      });
    const [a, b] = await Promise.all([save(), save()]);

    expect(creates).toBe(1);
    expect([a.status, b.status].sort()).toEqual(["created", "existing"]);
    const { rows } = await pool.query(
      `select count(*)::int as n from evidence_items where user_id = $1 and title = 'Harden nginx'`,
      [userId]
    );
    expect(rows[0].n).toBe(1);
  });
});
