import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("Transactional outbox against PostgreSQL", () => {
  let pool: import("pg").Pool;
  let db: import("@careeros/database").Database;
  let userId: string;

  beforeAll(async () => {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    pool = new Pool({ connectionString: URL });
    db = drizzle(pool) as never;
    userId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `outbox-${Date.now()}@example.test`,
      ])
    ).rows[0].id;
  });

  afterAll(async () => {
    if (userId) await pool.query("delete from users where id = $1", [userId]);
    await pool?.end();
  });

  it("queues a fact once, however many times it is enqueued", async () => {
    const { enqueueOutbox } = await import("./topics");
    const key = `dedupe-${Date.now()}`;
    await enqueueOutbox(db, userId, "application.changed", { applicationId: "x" }, key);
    await enqueueOutbox(db, userId, "application.changed", { applicationId: "x" }, key);
    const { rows } = await pool.query(
      "select count(*)::int as n from outbox_events where dedupe_key = $1",
      [`application.changed:${key}`]
    );
    expect(rows[0].n).toBe(1);
  });

  it("drops the event with the transaction that failed", async () => {
    const { enqueueOutbox } = await import("./topics");
    const key = `rollback-${Date.now()}`;
    await db
      .transaction(async (tx) => {
        await enqueueOutbox(tx, userId, "application.changed", { applicationId: "y" }, key);
        throw new Error("the producer's own write failed");
      })
      .catch(() => undefined);
    const { rows } = await pool.query(
      "select count(*)::int as n from outbox_events where dedupe_key = $1",
      [`application.changed:${key}`]
    );
    expect(rows[0].n).toBe(0);
  });

  it("gives two concurrent workers disjoint events", async () => {
    const { createOutboxRepository } = await import("@careeros/database");
    const { enqueueOutbox } = await import("./topics");
    await pool.query("update outbox_events set status = 'done' where status = 'pending'");
    for (let i = 0; i < 6; i++) {
      await enqueueOutbox(
        db,
        userId,
        "application.changed",
        { applicationId: `c${i}` },
        `c-${Date.now()}-${i}`
      );
    }
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const other = new Pool({ connectionString: URL });
    try {
      const [a, b] = await Promise.all([
        createOutboxRepository(db).claim(4),
        createOutboxRepository(drizzle(other) as never).claim(4),
      ]);
      const ids = [...a, ...b].map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBe(6);
    } finally {
      await other.end();
    }
  });

  it("backs off a failure and gives up once the attempts are spent", async () => {
    const { createOutboxRepository, OUTBOX_MAX_ATTEMPTS } = await import("@careeros/database");
    const { enqueueOutbox } = await import("./topics");
    const repo = createOutboxRepository(db);
    await pool.query("update outbox_events set status = 'done' where status = 'pending'");
    await enqueueOutbox(
      db,
      userId,
      "application.changed",
      { applicationId: "z" },
      `z-${Date.now()}`
    );
    const [claimed] = await repo.claim(1);
    await repo.fail(claimed, "boom");
    expect(await repo.claim(1)).toEqual([]); // not due until the backoff passes

    await repo.fail({ id: claimed.id, attempts: OUTBOX_MAX_ATTEMPTS }, "still boom");
    const { rows } = await pool.query(
      "select status, last_error from outbox_events where id = $1",
      [claimed.id]
    );
    expect(rows[0]).toEqual({ status: "failed", last_error: "still boom" });
    expect(await repo.retry(userId, claimed.id)).toBe(true);
  });

  it("closes the project's work step and records the evidence when learning completes", async () => {
    const { createWorkItemsRepository } = await import("@careeros/database");
    const { outboxHandlers } = await import("./handlers");
    const work = createWorkItemsRepository(db);
    const goal = await work.create(userId, { kind: "goal", title: "Get hired", status: "active" });
    const runId = "00000000-0000-4000-8000-000000000001";
    const step = await work.create(userId, {
      kind: "step",
      parentId: goal.id,
      title: "Build the lab",
      status: "active",
      refs: [{ type: "project_run", id: runId }],
    });
    const evidenceItemId = "00000000-0000-4000-8000-0000000000e1";
    const handler = outboxHandlers(db)["learning.completed"];
    const delivery = {
      id: "e",
      userId,
      topic: "learning.completed",
      payload: { evidenceItemId, runId },
    } as never;
    await handler(delivery);
    await handler(delivery); // at-least-once: a second delivery changes nothing

    expect((await work.get(userId, step.id))?.status).toBe("done");
    const outputs = await work.listOutputs(userId, { workItemId: step.id, kind: "evidence" });
    expect(outputs.map((o) => o.refId)).toEqual([evidenceItemId]);
  });

  it("turns a finished practice interview's weakest area into one open step", async () => {
    const { createWorkItemsRepository } = await import("@careeros/database");
    const { outboxHandlers } = await import("./handlers");
    const work = createWorkItemsRepository(db);
    const goal = (await work.activeGoal(userId))!;
    const questions = [
      {
        question: "Q1",
        review: {
          scores: { structure: 4, specificity: 2, relevance: 4, concision: 4 },
          improvements: ["Name the tool."],
        },
      },
    ];
    const session = (
      await pool.query(
        "insert into interview_sessions (user_id, role, stage, duration_minutes, status, questions, completed_at) values ($1, 'SOC Analyst', 'behavioral', 10, 'completed', $2, now()) returning id",
        [userId, JSON.stringify(questions)]
      )
    ).rows[0];
    const handler = outboxHandlers(db)["interview.completed"];
    const delivery = {
      id: "i",
      userId,
      topic: "interview.completed",
      payload: { sessionId: session.id },
    } as never;
    await handler(delivery);
    await handler(delivery);

    const steps = await work.listForRef(userId, { type: "interview_followup", id: session.id });
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ status: "open", parentId: goal.id });
    expect(steps[0].title).toMatch(/what you did/);
  });
});
