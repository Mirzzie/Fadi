import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * THE FIRST NON-TECHNICAL PRACTICE JOURNEY, against a real database (Gate 3 acceptance):
 * start a work simulation → write → "not yet" → revise → pass → observed receipts → the existing
 * finish review. Only the model is faked; it answers the way the real one must — quoting the
 * person's own words — so the code under test is the real review, receipt and completion path.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/database/client", () => ({ getDatabase: () => holder.db }));
vi.mock("@/lib/ai/user-generate", () => ({
  getUserDocGenerate: async () => ({
    // A fair reviewer: every quality criterion "meets", quoting the first 40 characters written.
    structured: async (_system: string, user: string) => {
      const submission = user.split('"""')[1]!.trim();
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
      (await pool.query("insert into users (email) values ($1) returning id", [`${tag}-${stamp}@example.test`]))
        .rows[0].id as string;
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
      [userId, request.packId, request.activityId, "Quarterly churn review for a B2B software company"]
    );
    expect(counts.rows[0]).toEqual({ runs: 1, commitments: 1 });

    const { run, steps } = await project();
    expect(run.practice).toMatchObject({ packId: "fadi.customer-success", packVersion: "0.1.0" });
    expect(run.practice!.seed).toMatch(/^[0-9a-f]{32}$/);
    expect(run.commitmentId).not.toBeNull();
    expect(steps.map((s) => s.place)).toEqual(["document", "document", "document"]);
    expect(run.detail).toContain("| Account |");
  });

  it("'not yet' when the facts are wrong — however well written — with no example answer to copy", async () => {
    const { churnCase } = await import("./sim/churn-case");
    const { submitForReview } = await import("./document-sim");
    const { run, steps } = await project();
    const c = churnCase(run.practice!.seed);
    const wrong = c.accounts.find((a) => !c.atRisk.includes(a.name) && a.name !== c.decoy)!;
    const result = await submitForReview(userId, {
      runId,
      stepId: steps[0]!.id,
      body: `${wrong.name} is clearly the biggest risk because its renewal is coming up and usage looks soft across the quarter.`,
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
      body: `${c.atRisk[0]} is most urgent: tickets past SLA and weekly active users down sharply before renewal. ${c.atRisk[1]} is next because its executive sponsor left. ${c.decoy} only looks bad: the drop is seasonal, their busy season is later.`,
    });
    expect(result.ok && result.review).toMatchObject({ verdict: "pass", attempt: 2 });
    expect(result.ok && result.review.exampleAnswer).toContain(c.atRisk[0]);

    const step = (await project()).steps[0]!;
    expect(step).toMatchObject({ status: "done", completion: "evidenced" });

    const { createPracticeReceiptsRepository } = await import("@careeros/database");
    const receipts = await createPracticeReceiptsRepository(holder.db as never).listForStep(userId, step.id);
    expect(receipts.map((r) => r.verdict).sort()).toEqual(["fail", "pass"]);
    expect(new Set(receipts.map((r) => r.strength))).toEqual(new Set(["observed"]));
    expect(receipts.every((r) => r.assessmentKind === "rubric" && r.sourceKind === "practice_submission")).toBe(true);
  });

  it("one attempt, one receipt — recording the same review again changes nothing", async () => {
    const { createPracticeReceiptsRepository, createPracticeSubmissionsRepository } = await import(
      "@careeros/database"
    );
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

  it("the existing finish review says how it was established: reviewed against a rubric", async () => {
    const { createPracticeReceiptsRepository } = await import("@careeros/database");
    const { completionReview } = await import("@/lib/learning/project-review");
    const { run, steps } = await project();
    const receipts = await createPracticeReceiptsRepository(holder.db as never).listForRun(userId, run.id);
    const review = completionReview(run.title, steps, receipts);
    expect(review.lines[0]).toMatchObject({ proof: "reviewed" });
    expect(review.lines[0]!.result).toMatch(/criteria met on attempt 2, unaided/);
    expect(review.summary).toContain("reviewed against a rubric");
  });
});
