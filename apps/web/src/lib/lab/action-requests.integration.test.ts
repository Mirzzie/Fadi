import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * APPROVAL, AGAINST A REAL DATABASE.
 *
 * An approval is spent exactly once. That is not a property of the code around the
 * repository — it is a property of the UPDATE's WHERE clause, and a mocked repository
 * will happily agree with a clause that has none.
 *
 * The failure this guards against is concrete and bad: a double-click, or a retry racing
 * itself, running `docker run` twice from one approval the person gave once.
 *
 * Requires FADI_TEST_DATABASE_URL pointed at a database this may modify.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("a write waits for a person, and is spent once", () => {
  let pool: import("pg").Pool;
  let repo: ReturnType<typeof import("@careeros/database").createLabActionRequestsRepository>;
  let userId: string;

  const proposal = (over: Record<string, unknown> = {}) => ({
    userId,
    recipe: "container.run",
    params: { image: "nginx", name: "web", port: null },
    argv: [["docker", "run", "-d", "--name", "fadi-web", "nginx:1.27-alpine"]],
    summary: "Start nginx.",
    reversal: "docker rm -f fadi-web",
    actor: "model",
    origin: "test",
    expiresAt: new Date(Date.now() + 10 * 60_000),
    ...over,
  });

  beforeAll(async () => {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const { createLabActionRequestsRepository } = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    repo = createLabActionRequestsRepository(drizzle(pool) as never);

    const { rows } = await pool.query(`insert into users (email) values ($1) returning id`, [
      `req-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
    ]);
    userId = rows[0].id as string;
  }, 60_000);

  afterAll(async () => {
    if (userId) await pool.query(`delete from users where id = $1`, [userId]);
    await pool?.end();
  });

  beforeEach(async () => {
    await pool.query(`delete from lab_action_requests where user_id = $1`, [userId]);
  });

  it("a proposal starts pending and shows up as waiting", async () => {
    const row = await repo.propose(proposal() as never);
    expect(row.status).toBe("pending");
    expect((await repo.listPending(userId)).map((r) => r.id)).toEqual([row.id]);
  });

  it("THE RACE: two approvals of the same request, only one wins", async () => {
    const row = await repo.propose(proposal() as never);

    // Both start before either finishes — the shape of a double-click.
    const [a, b] = await Promise.all([
      repo.approve(userId, row.id),
      repo.approve(userId, row.id),
    ]);

    const winners = [a, b].filter(Boolean);
    // If both came back non-null, the command would run twice from one approval.
    expect(winners).toHaveLength(1);
  });

  it("an expired prompt cannot be approved, however it is clicked", async () => {
    const row = await repo.propose(proposal({ expiresAt: new Date(Date.now() - 1000) }) as never);

    expect(await repo.approve(userId, row.id)).toBeNull();
    // ...and it is not shown as waiting either.
    expect(await repo.listPending(userId)).toHaveLength(0);
  });

  it("a denied request stays denied and cannot be approved afterwards", async () => {
    const row = await repo.propose(proposal() as never);
    await repo.deny(userId, row.id);

    expect(await repo.approve(userId, row.id)).toBeNull();
    const after = (await repo.recent(userId)).find((r) => r.id === row.id);
    expect(after?.status).toBe("denied");
  });

  it("one person's pending request is not another's to approve", async () => {
    const row = await repo.propose(proposal() as never);
    const { rows } = await pool.query(`insert into users (email) values ($1) returning id`, [
      `req-other-${Date.now()}@example.test`,
    ]);
    const otherId = rows[0].id as string;
    try {
      expect(await repo.approve(otherId, row.id)).toBeNull();
    } finally {
      await pool.query(`delete from users where id = $1`, [otherId]);
    }
  });

  it("only EXECUTED runs count as things Fadi created", async () => {
    // What stop/remove is allowed to name comes from what actually ran. A proposal that
    // was never approved must not make a container look like Fadi's work.
    const pending = await repo.propose(proposal({ params: { image: "nginx", name: "ghost" } }) as never);
    const done = await repo.propose(proposal({ params: { image: "nginx", name: "real" } }) as never);
    await repo.approve(userId, done.id);
    await repo.finish(userId, done.id, { status: "executed", detail: "abc123" });

    const names = await repo.createdNames(userId, "container.run");
    expect(names).toContain("real");
    expect(names).not.toContain("ghost");
    expect(pending.status).toBe("pending");
  });

  it("keeps what a step's check printed, bounded, for that step only (16 Oct 2026)", async () => {
    const runId = "33333333-3333-4333-8333-333333333333";
    const stepId = "44444444-4444-4444-8444-444444444444";
    const row = await repo.propose(proposal({ recipe: "lab.check", runId, stepId }) as never);
    await repo.approve(userId, row.id);
    const printed = "x".repeat(9_000) + "\nGet-Service : Cannot find any service with service name 'WazuhSvc'.";
    await repo.finish(userId, row.id, { status: "executed", detail: "Check did not pass", output: printed });

    const last = await repo.latestForStep(userId, stepId, "lab.check");
    // The tail is where the error is: bounded from the end, never the start.
    expect(last?.output?.length).toBe(8_000);
    expect(last?.output?.endsWith("name 'WazuhSvc'.")).toBe(true);
    expect(await repo.latestForStep(userId, stepId, "vmware.start")).toBeNull();
    const stranger = "55555555-5555-4555-8555-555555555555";
    expect(await repo.latestForStep(stranger, stepId, "lab.check")).toBeNull();
  });
});

