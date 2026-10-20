import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("immutable Practice receipts", () => {
  let pool: import("pg").Pool;
  let runs: import("@careeros/database").ProjectRunsRepository;
  let requests: import("@careeros/database").LabActionRequestsRepository;
  let receipts: import("@careeros/database").PracticeReceiptsRepository;
  let userId: string;
  let strangerId: string;

  beforeAll(async () => {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const {
      createLabActionRequestsRepository,
      createPracticeReceiptsRepository,
      createProjectRunsRepository,
    } = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    const db = drizzle(pool) as never;
    const stamp = Date.now();
    userId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `receipt-${stamp}@example.test`,
      ])
    ).rows[0].id;
    strangerId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `receipt-other-${stamp}@example.test`,
      ])
    ).rows[0].id;
    runs = createProjectRunsRepository(db);
    requests = createLabActionRequestsRepository(db);
    receipts = createPracticeReceiptsRepository(db);
  });

  afterAll(async () => {
    if (userId) await pool.query("delete from users where id = any($1)", [[userId, strangerId]]);
    await pool?.end();
  });

  async function planned(title = "Check a service") {
    return runs.createWithSteps(userId, { title, detail: "Observe a real result." }, [
      {
        ordinal: 1,
        title: "Verify the service",
        instruction: "Inspect the service state.",
        status: "pending",
      },
    ]);
  }

  async function approved(runId: string, stepId: string) {
    const request = await requests.propose({
      userId,
      kind: "action",
      recipe: "lab.check",
      params: { command: "status", expect: "Running" },
      argv: [["status"]],
      summary: "Check whether the service is running.",
      reversal: null,
      preflight: [],
      actor: "user",
      origin: "web",
      runId,
      stepId,
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(await requests.approve(userId, request.id)).not.toBeNull();
    return request;
  }

  it("finishes the request, verifies the step and appends one receipt atomically", async () => {
    const { run, steps } = await planned();
    const request = await approved(run.id, steps[0].id);
    const input = {
      requestId: request.id,
      runId: run.id,
      stepId: steps[0].id,
      verdict: "pass" as const,
      detail: 'Check passed: found "Running".',
      output: "WazuhSvc Running",
      artifact: "Checked in the lab: status → WazuhSvc Running",
      evidence: { seen: "The service reported Running.", excerpt: "WazuhSvc Running" },
    };

    const first = await receipts.completeMachineCheck(userId, input);
    const retry = await receipts.completeMachineCheck(userId, input);

    expect(retry.receipt.id).toBe(first.receipt.id);
    expect(first.receipt).toMatchObject({
      assessmentKind: "machine_predicate",
      assessmentId: "lab.check",
      assessmentVersion: "1",
      verdict: "pass",
      strength: "verified",
      sourceKind: "lab_action_request",
      sourceRefId: request.id,
    });
    expect(first.step).toMatchObject({ status: "done", completion: "verified" });
    expect((await requests.get(userId, request.id))?.status).toBe("executed");
    expect(await receipts.listForStep(userId, steps[0].id)).toHaveLength(1);
    expect((await runs.getWithSteps(userId, run.id))?.run.status).toBe("done");
  });

  it("records a failed observation without claiming the step was completed", async () => {
    const { run, steps } = await planned("Failure stays open");
    const request = await approved(run.id, steps[0].id);
    const result = await receipts.completeMachineCheck(userId, {
      requestId: request.id,
      runId: run.id,
      stepId: steps[0].id,
      verdict: "fail",
      detail: 'Check did not pass: "Running" was not in the output.',
      output: "WazuhSvc Stopped",
      artifact: "",
      evidence: { seen: "The service did not report Running.", excerpt: "WazuhSvc Stopped" },
    });

    expect(result.receipt.verdict).toBe("fail");
    expect(result.receipt.strength).toBe("verified");
    expect(result.step).toMatchObject({ status: "pending", completion: null });
    expect((await runs.getWithSteps(userId, run.id))?.run.status).toBe("running");
    expect((await requests.get(userId, request.id))?.status).toBe("executed");
  });

  it("will not attach another person's approved check to a receipt", async () => {
    const { run, steps } = await planned("Ownership");
    const request = await approved(run.id, steps[0].id);
    await expect(
      receipts.completeMachineCheck(strangerId, {
        requestId: request.id,
        runId: run.id,
        stepId: steps[0].id,
        verdict: "pass",
        detail: "Check passed.",
        output: "Running",
        artifact: "Running",
        evidence: { seen: "Running" },
      })
    ).rejects.toThrow(/unavailable/);
  });

  it("changes nothing when the bounded receipt is invalid", async () => {
    const { run, steps } = await planned("Atomic rejection");
    const request = await approved(run.id, steps[0].id);
    await expect(
      receipts.completeMachineCheck(userId, {
        requestId: request.id,
        runId: run.id,
        stepId: steps[0].id,
        verdict: "pass",
        detail: "Check passed.",
        output: "Running",
        artifact: "Running",
        evidence: { seen: "x".repeat(401) },
      })
    ).rejects.toThrow(/summary is invalid/);

    expect((await requests.get(userId, request.id))?.status).toBe("approved");
    expect((await runs.getWithSteps(userId, run.id))?.steps[0]).toMatchObject({
      status: "pending",
      completion: null,
    });
    expect(await receipts.listForStep(userId, steps[0].id)).toHaveLength(0);
  });

  it("keeps the bounded receipt and labels when a temporary run is removed", async () => {
    const { run, steps } = await planned("Disposable project");
    const request = await approved(run.id, steps[0].id);
    const { receipt } = await receipts.completeMachineCheck(userId, {
      requestId: request.id,
      runId: run.id,
      stepId: steps[0].id,
      verdict: "pass",
      detail: "Check passed.",
      output: "pass",
      artifact: "pass",
      evidence: { seen: "The predicate passed." },
    });

    expect(await runs.remove(userId, run.id)).toBe(true);
    const kept = await pool.query(
      "select run_id, step_id, run_label, step_label from practice_receipts where id = $1",
      [receipt.id]
    );
    expect(kept.rows[0]).toMatchObject({
      run_id: null,
      step_id: null,
      run_label: "Disposable project",
      step_label: "Verify the service",
    });
  });
});
