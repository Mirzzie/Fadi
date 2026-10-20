import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

const holder = vi.hoisted(() => ({ db: null as unknown, userId: "" }));
vi.mock("@/lib/database/client", () => ({ getDatabase: () => holder.db }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentAuthUser: async () => ({
    id: holder.userId,
    email: "learning-completion@example.test",
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

suite("learning commitment completion", () => {
  let pool: import("pg").Pool;
  let commitments: ReturnType<
    typeof import("@careeros/database").createLearningCommitmentsRepository
  >;
  let runs: ReturnType<typeof import("@careeros/database").createProjectRunsRepository>;
  let actions: typeof import("./actions");

  beforeAll(async () => {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const db = await import("@careeros/database");

    pool = new Pool({ connectionString: URL });
    holder.db = drizzle(pool) as never;
    holder.userId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `learning-completion-${Date.now()}@example.test`,
      ])
    ).rows[0].id as string;
    commitments = db.createLearningCommitmentsRepository(holder.db as never);
    runs = db.createProjectRunsRepository(holder.db as never);
    actions = await import("./actions");
  });

  afterAll(async () => {
    if (holder.userId) await pool.query("delete from users where id = $1", [holder.userId]);
    await pool?.end();
  });

  it("routes a hands-on commitment to its project instead of completing it twice", async () => {
    const commitment = await commitments.createForUser(holder.userId, {
      gap: "Linux hardening",
      title: "Harden nginx",
      kind: "project",
    });
    const { run } = await runs.createWithSteps(
      holder.userId,
      { title: commitment.title, commitmentId: commitment.id },
      [{ ordinal: 1, title: "Configure", instruction: "Edit nginx.conf" }]
    );

    const result = await actions.completeCommitmentAction({
      id: commitment.id,
      whatIBuilt: "This text must not become evidence from the shortcut.",
    });

    expect(result).toEqual({
      ok: false,
      message: "Finish this from its project workspace so the steps and proof stay together.",
      runId: run.id,
    });
    expect((await commitments.getForUser(holder.userId, commitment.id))?.status).toBe("committed");
    expect(
      (
        await pool.query(
          "select count(*)::int as count from evidence_items where user_id = $1 and origin = 'learning'",
          [holder.userId]
        )
      ).rows[0].count
    ).toBe(0);
  });

  it("does not route to an abandoned run", async () => {
    const commitment = await commitments.createForUser(holder.userId, {
      gap: "Networking",
      title: "Build a packet lab",
      kind: "project",
    });
    const { run } = await runs.createWithSteps(
      holder.userId,
      { title: commitment.title, commitmentId: commitment.id },
      [{ ordinal: 1, title: "Capture", instruction: "Run tcpdump" }]
    );
    await runs.abandon(holder.userId, run.id);

    const result = await actions.completeCommitmentAction({
      id: commitment.id,
      whatIBuilt: "too short",
    });

    expect(result.ok).toBe(false);
    expect(result.runId).toBeUndefined();
    expect(result.message).toMatch(/Tell me what you actually built/);
  });
});
