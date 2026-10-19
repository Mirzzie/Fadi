import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * THE FIRST NON-TECHNICAL PRACTICE JOURNEY, against a real database (Gate 3 acceptance):
 * start a work simulation → write → "not yet" → revise → pass → observed receipts → the existing
 * finish review. Only the model is faked; it answers the way the real one must — quoting the
 * person's own words — so the code under test is the real review, receipt and completion path.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

const holder = vi.hoisted(() => ({ db: null as unknown, failReviews: 0 }));
vi.mock("@/lib/database/client", () => ({ getDatabase: () => holder.db }));
vi.mock("@/lib/ai/user-generate", () => ({
  getUserDocGenerate: async () => ({
    // A fair reviewer: every quality criterion "meets", quoting the first 40 characters written.
    structured: async (_system: string, user: string) => {
      if (holder.failReviews > 0) {
        holder.failReviews -= 1;
        throw new Error("provider unavailable");
      }
      const submission = user
        .split("BEGIN UNTRUSTED SUBMISSION")[1]!
        .split("END UNTRUSTED SUBMISSION")[0]!
        .trim();
      const ids = [...user.matchAll(/- id: (\S+)/g)].map((m) => m[1]!);
      return {
        criteria: ids.map((id) => ({
          id,
          level: "meets",
          quote: submission.slice(0, 40),
          feedback: "Clear and specific.",
        })),
      };
    },
  }),
}));

suite("a document work simulation, end to end", () => {
  let pool: import("pg").Pool;
  let userId: string;
  let strangerId: string;
  let runId: string;

  beforeAll(async () => {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    pool = new Pool({ connectionString: URL });
    holder.db = drizzle(pool) as never;
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const user = async (tag: string) =>
      (
        await pool.query("insert into users (email) values ($1) returning id", [
          `${tag}-${stamp}@example.test`,
        ])
      ).rows[0].id as string;
    userId = await user("sim");
    strangerId = await user("sim-other");
  });

  afterAll(async () => {
    if (userId) await pool.query("delete from users where id = any($1)", [[userId, strangerId]]);
    await pool?.end();
  });

  const project = async (owner = userId) => {
    const { createProjectRunsRepository } = await import("@careeros/database");
    return (await createProjectRunsRepository(holder.db as never).getWithSteps(owner, runId))!;
  };

  it("starts from the pack once even when two tabs start together", async () => {
    const { startPracticeActivity } = await import("./document-sim");
    const request = { packId: "fadi.customer-success", activityId: "churn-review" };
    const [started, racing] = await Promise.all([
      startPracticeActivity(userId, request),
      startPracticeActivity(userId, request),
    ]);
    expect(started.ok).toBe(true);
    runId = started.ok ? started.runId : "";
    expect(racing).toEqual({ ok: true, runId });

    const counts = await pool.query(
      `select
         (select count(*)::int from project_runs
          where user_id = $1 and status = 'running'
            and practice->>'packId' = $2 and practice->>'activityId' = $3) as runs,
         (select count(*)::int from learning_commitments
          where user_id = $1 and title = $4 and status = 'committed') as commitments`,
      [
        userId,
        request.packId,
        request.activityId,
        "Quarterly churn review for a B2B software company",
      ]
    );
    expect(counts.rows[0]).toEqual({ runs: 1, commitments: 1 });

    const { run, steps } = await project();
    expect(run.practice).toMatchObject({ packId: "fadi.customer-success", packVersion: "0.2.0" });
    expect(run.practice!.seed).toMatch(/^[0-9a-f]{32}$/);
    expect(run.commitmentId).not.toBeNull();
    expect(steps.map((s) => s.place)).toEqual(["document", "document", "document"]);
    expect(run.detail).toContain("| Account |");
  });

  it("refuses step 1 without its picks, and keeps nothing", async () => {
    const { submitForReview } = await import("./document-sim");
    const { steps } = await project();
    const result = await submitForReview(userId, {
      runId,
      stepId: steps[0]!.id,
      body: "A careful analysis of every account in the table, with figures for each one.",
    });
    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/every choice/) });
    const count = await pool.query(
      "select count(*)::int as count from practice_submissions where step_id = $1",
      [steps[0]!.id]
    );
    expect(count.rows[0]).toEqual({ count: 0 });
  });

  it("'not yet' when the picks are wrong — however well written — with no example answer to copy", async () => {
    const { churnCase } = await import("./sim/churn-case");
    const { submitForReview } = await import("./document-sim");
    const { run, steps } = await project();
    const c = churnCase(run.practice!.seed);
    const wrong = c.accounts.find((a) => !c.atRisk.includes(a.name) && a.name !== c.decoy)!;
    const result = await submitForReview(userId, {
      runId,
      stepId: steps[0]!.id,
      // The right names in the writing don't count: the picks decide.
      choices: { "risk-1": wrong.name, "risk-2": c.atRisk[0], "false-alarm": "None of them" },
      body: `${wrong.name} is clearly the biggest risk because its renewal is coming up; ${c.atRisk[1]} too.`,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.review.verdict).toBe("fail");
    expect(result.review.results.find((r) => r.id === "names-risks")).toMatchObject({
      level: "not_yet",
      decidedBy: "code",
    });
    expect(result.review.exampleAnswer).toBeNull();
    expect((await project()).steps[0]!.status).toBe("pending");
  });

  it("passes the revised attempt: the step completes as evidenced, the receipt is observed — never verified", async () => {
    const { churnCase } = await import("./sim/churn-case");
    const { submitForReview } = await import("./document-sim");
    const { run, steps } = await project();
    const c = churnCase(run.practice!.seed);
    const result = await submitForReview(userId, {
      runId,
      stepId: steps[0]!.id,
      choices: { "risk-1": c.atRisk[0], "risk-2": c.atRisk[1], "false-alarm": c.decoy },
      // Each at-risk account backed by two of its own figures — checked exactly since 19 Oct 2026.
      body: `${c.atRisk
        .map((name) => {
          const a = c.accounts.find((x) => x.name === name)!;
          const change = Math.round(((a.activeNow - a.active90) / a.active90) * 100);
          return `${name}: weekly users ${change}% in 90 days, renewal in ${a.renewalDays} days, $${a.arrK}k ARR.`;
        })
        .join(" ")} ${c.decoy} only looks bad: the drop is seasonal, their busy season is later.`,
    });
    expect(result.ok && result.review).toMatchObject({ verdict: "pass", attempt: 2 });
    expect(result.ok && result.review.exampleAnswer).toContain(c.atRisk[0]);
    // The attempt is one immutable text: the picks above the writing.
    const { createPracticeSubmissionsRepository } = await import("@careeros/database");
    const kept = await createPracticeSubmissionsRepository(holder.db as never).latestForStep(
      userId,
      steps[0]!.id
    );
    expect(kept!.body.split("\n")[0]).toBe(`Most at risk: ${c.atRisk[0]}`);

    const step = (await project()).steps[0]!;
    expect(step).toMatchObject({ status: "done", completion: "evidenced" });

    const { createPracticeReceiptsRepository } = await import("@careeros/database");
    const receipts = await createPracticeReceiptsRepository(holder.db as never).listForStep(
      userId,
      step.id
    );
    expect(receipts.map((r) => r.verdict).sort()).toEqual(["fail", "pass"]);
    expect(new Set(receipts.map((r) => r.strength))).toEqual(new Set(["observed"]));
    expect(
      receipts.every((r) => r.assessmentKind === "rubric" && r.sourceKind === "practice_submission")
    ).toBe(true);
  });

  it("one attempt, one receipt — recording the same review again changes nothing", async () => {
    const { createPracticeReceiptsRepository, createPracticeSubmissionsRepository } =
      await import("@careeros/database");
    const db = holder.db as never;
    const { steps } = await project();
    const last = await createPracticeSubmissionsRepository(db).latestForStep(userId, steps[0]!.id);
    const repeat = await createPracticeReceiptsRepository(db).recordRubricReview(userId, {
      submissionId: last!.id,
      assessmentId: "fadi.rubric",
      assessmentVersion: "1",
      verdict: "pass",
      met: 3,
      total: 3,
      evidence: { seen: "again" },
    });
    expect(repeat.receipt.evidence.seen).not.toBe("again");
  });

  it("refuses another person's run and a closed step", async () => {
    const { submitForReview } = await import("./document-sim");
    const { steps } = await project();
    const stranger = await submitForReview(strangerId, {
      runId,
      stepId: steps[1]!.id,
      body: "I am not the owner of this run and should not be able to hand anything in.",
    });
    expect(stranger.ok).toBe(false);
    const closed = await submitForReview(userId, {
      runId,
      stepId: steps[0]!.id,
      body: "Handing in again to a step that has already passed should be refused.",
    });
    expect(closed.ok).toBe(false);
  });

  it("refuses future steps and submissions to abandoned runs", async () => {
    const { createPracticeSubmissionsRepository } = await import("@careeros/database");
    const submissions = createPracticeSubmissionsRepository(holder.db as never);
    const { steps } = await project();
    // Step 1 is complete, so step 2 is current and step 3 must remain unreachable.
    expect(
      await submissions.submit(userId, {
        runId,
        stepId: steps[2]!.id,
        body: "This direct call must not skip over the current retention-plan step.",
      })
    ).toBeNull();

    const { startPracticeActivity } = await import("./document-sim");
    const abandoned = await startPracticeActivity(strangerId, {
      packId: "fadi.customer-success",
      activityId: "churn-review",
    });
    expect(abandoned.ok).toBe(true);
    if (!abandoned.ok) return;
    // project() refers to the primary run, so load the abandoned run explicitly.
    const { createProjectRunsRepository } = await import("@careeros/database");
    const owned = await createProjectRunsRepository(holder.db as never).getWithSteps(
      strangerId,
      abandoned.runId
    );
    expect(owned).not.toBeNull();
    await pool.query("update project_runs set status = 'abandoned' where id = $1", [
      abandoned.runId,
    ]);
    expect(
      await submissions.submit(strangerId, {
        runId: abandoned.runId,
        stepId: owned!.steps[0]!.id,
        body: "An abandoned simulation must remain closed to new assessed submissions.",
      })
    ).toBeNull();
  });

  it("retries the same immutable attempt after a provider failure", async () => {
    const { churnCase } = await import("./sim/churn-case");
    const { submitForReview } = await import("./document-sim");
    const { run, steps } = await project();
    const c = churnCase(run.practice!.seed);
    const body = `${c.atRisk[0]}: support owns the breached-ticket recovery this week. ${c.atRisk[1]}: I own finding a new sponsor within ten days. We will measure tickets within SLA and a renewal meeting booked. We will not spend this month on ${c.decoy} because its dip is seasonal.`;
    holder.failReviews = 1;
    const failed = await submitForReview(userId, { runId, stepId: steps[1]!.id, body });
    expect(failed).toMatchObject({ ok: false });
    const retried = await submitForReview(userId, { runId, stepId: steps[1]!.id, body });
    expect(retried.ok && retried.review).toMatchObject({ attempt: 1 });
    const count = await pool.query(
      "select count(*)::int as count from practice_submissions where step_id = $1",
      [steps[1]!.id]
    );
    expect(count.rows[0]).toEqual({ count: 1 });
  });

  it("records a hint on the step, so the next attempt says 'with 1 hint' — and a reload can't undo it", async () => {
    const { revealHint, submitForReview, documentStepState } = await import("./document-sim");
    const { steps } = await project();
    const step3 = steps[2]!;
    expect(await revealHint(userId, { runId, stepId: steps[0]!.id })).toMatchObject({ ok: false });
    expect(await revealHint(strangerId, { runId, stepId: step3.id })).toMatchObject({ ok: false });
    const opened = await revealHint(userId, { runId, stepId: step3.id });
    expect(opened.ok && opened.hints).toHaveLength(1);
    const state = await documentStepState(userId, { runId, stepId: step3.id });
    expect(state).toMatchObject({ hints: [expect.any(String)], hintsAvailable: 3 });

    const result = await submitForReview(userId, {
      runId,
      stepId: step3.id,
      body: "A blanket discount gives away revenue on accounts renewing anyway and fixes neither cause; I'd fix service and find a new sponsor instead.",
    });
    expect(result.ok && result.review.verdict).toBe("pass");
    const { createPracticeReceiptsRepository } = await import("@careeros/database");
    const receipts = await createPracticeReceiptsRepository(holder.db as never).listForStep(
      userId,
      step3.id
    );
    expect(receipts[0]!.evidence.seen).toMatch(/with 1 hint/);
  });

  it("the existing finish review says how it was established: reviewed against a rubric", async () => {
    const { createPracticeReceiptsRepository } = await import("@careeros/database");
    const { completionReview } = await import("@/lib/learning/project-review");
    const { run, steps } = await project();
    const receipts = await createPracticeReceiptsRepository(holder.db as never).listForRun(
      userId,
      run.id
    );
    const review = completionReview(run.title, steps, receipts);
    expect(review.lines[0]).toMatchObject({ proof: "reviewed" });
    expect(review.lines[0]!.result).toMatch(/criteria met on attempt 2, unaided/);
    expect(review.summary).toContain("reviewed against a rubric");
  });

  it("keeps assessed source text by refusing hard deletion of a practice run", async () => {
    const { createPracticeSubmissionsRepository, createProjectRunsRepository } =
      await import("@careeros/database");
    const db = holder.db as never;
    const { steps } = await project();
    const source = await createPracticeSubmissionsRepository(db).latestForStep(
      userId,
      steps[0]!.id
    );
    expect(source?.body).toContain("only looks bad");
    expect(await createProjectRunsRepository(db).remove(userId, runId)).toBe(false);
    expect(await createPracticeSubmissionsRepository(db).get(userId, source!.id)).toEqual(source);
    expect(await createPracticeSubmissionsRepository(db).get(strangerId, source!.id)).toBeNull();
  });

  it("starts over with a new case: the old attempt is closed and kept, not deleted", async () => {
    const { startPracticeActivity, restartPracticeActivity, submitForReview } =
      await import("./document-sim");
    const { createProjectRunsRepository } = await import("@careeros/database");
    const runs = createProjectRunsRepository(holder.db as never);
    const first = await startPracticeActivity(strangerId, {
      packId: "fadi.customer-success",
      activityId: "churn-review",
    });
    if (!first.ok) throw new Error(first.message);
    const before = (await runs.getWithSteps(strangerId, first.runId))!;
    await submitForReview(strangerId, {
      runId: first.runId,
      stepId: before.steps[0]!.id,
      choices: { "risk-1": "x", "risk-2": "y", "false-alarm": "z" },
      body: "Not a real answer, and its picks aren't from the case either.",
    });

    expect(await restartPracticeActivity(userId, { runId: first.runId })).toMatchObject({
      ok: false,
    });
    const restarted = await restartPracticeActivity(strangerId, { runId: first.runId });
    if (!restarted.ok) throw new Error(restarted.message);
    expect(restarted.runId).not.toBe(first.runId);

    const old = (await runs.getWithSteps(strangerId, first.runId))!;
    const fresh = (await runs.getWithSteps(strangerId, restarted.runId))!;
    expect(old.run.status).toBe("abandoned");
    expect(fresh.run).toMatchObject({ status: "running", commitmentId: before.run.commitmentId });
    expect(fresh.run.practice!.seed).not.toBe(before.run.practice!.seed);
    expect(fresh.steps.every((s) => s.status === "pending")).toBe(true);
    // Closed, so it can't be started over twice.
    expect(await restartPracticeActivity(strangerId, { runId: first.runId })).toMatchObject({
      ok: false,
    });
  });
});
