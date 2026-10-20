import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("Interview session lifecycle", () => {
  let pool: import("pg").Pool;
  let db: import("@careeros/database").Database;
  let sessions: ReturnType<typeof import("@careeros/database").createInterviewSessionsRepository>;
  let work: import("@careeros/database").WorkItemsRepository;
  let userId: string;
  let strangerId: string;

  beforeAll(async () => {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { createInterviewSessionsRepository, createWorkItemsRepository } =
      await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    db = drizzle(pool) as never;
    const stamp = Date.now();
    userId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `interview-session-${stamp}@example.test`,
      ])
    ).rows[0].id;
    strangerId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `interview-session-other-${stamp}@example.test`,
      ])
    ).rows[0].id;
    sessions = createInterviewSessionsRepository(db);
    work = createWorkItemsRepository(db);
  });

  afterAll(async () => {
    if (userId) await pool.query("delete from users where id = any($1)", [[userId, strangerId]]);
    await pool?.end();
  });

  it("persists the question set, links one work step, and closes both together", async () => {
    const { finishInterviewSessionWork, linkInterviewSessionToWork } =
      await import("@/lib/work/domain-links");
    const goal = await work.create(userId, {
      kind: "goal",
      title: "Land an application-security role",
      status: "active",
    });
    const session = await sessions.createForUser(userId, {
      role: "Application Security Engineer",
      company: "Intercom",
      stage: "technical",
      durationMinutes: 20,
      questions: [
        {
          question: "How would you threat-model a new API?",
          kind: "role",
        },
      ],
    });

    const first = await linkInterviewSessionToWork(db, userId, {
      sessionId: session.id,
      role: session.role,
      company: session.company,
      stage: session.stage,
    });
    const repeated = await linkInterviewSessionToWork(db, userId, {
      sessionId: session.id,
      role: session.role,
      company: session.company,
      stage: session.stage,
    });

    expect(first?.id).toBe(repeated?.id);
    expect(first?.parentId).toBe(goal.id);
    expect(first?.refs[0]).toEqual({ type: "interview_session", id: session.id });
    expect(
      await work.listForRef(userId, { type: "interview_session", id: session.id })
    ).toHaveLength(1);
    expect((await sessions.getForUser(userId, session.id))?.questions).toEqual(session.questions);
    expect(await sessions.getForUser(strangerId, session.id)).toBeNull();

    const { createInterviewSessionsRepository } = await import("@careeros/database");
    await db.transaction(async (tx) => {
      const finished = await createInterviewSessionsRepository(tx).finishForUser(
        userId,
        session.id,
        "completed"
      );
      expect(finished?.status).toBe("completed");
      await finishInterviewSessionWork(tx, userId, session.id, "completed");
    });

    expect((await sessions.getForUser(userId, session.id))?.completedAt).toBeInstanceOf(Date);
    expect((await work.get(userId, first!.id))?.status).toBe("done");

    // Network retries repeat the same result and cannot reverse a completed session.
    expect((await sessions.finishForUser(userId, session.id, "completed"))?.id).toBe(session.id);
    expect(await sessions.finishForUser(userId, session.id, "abandoned")).toBeNull();
  });

  it("refuses to attach somebody else's application", async () => {
    const result = await pool.query(
      "insert into applications (user_id, company, title) values ($1, 'Elsewhere', 'Engineer') returning id",
      [strangerId]
    );
    await expect(
      sessions.createForUser(userId, {
        applicationId: result.rows[0].id,
        role: "Engineer",
        stage: "recruiter",
        durationMinutes: 10,
        questions: [{ question: "Tell me about yourself.", kind: "opener" }],
      })
    ).rejects.toThrow(/unavailable/);

    const privateJob = await pool.query(
      "insert into jobs (source, external_id, owner_user_id, canonical_key, title, company) values ('manual', $1, $2, $1, 'Private role', 'Elsewhere') returning id",
      [`private-${Date.now()}`, strangerId]
    );
    await expect(
      sessions.createForUser(userId, {
        jobId: privateJob.rows[0].id,
        role: "Private role",
        stage: "recruiter",
        durationMinutes: 10,
        questions: [{ question: "Why this role?", kind: "opener" }],
      })
    ).rejects.toThrow(/unavailable/);
  });
});
