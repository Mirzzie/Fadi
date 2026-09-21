import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * EVERY CHANGE TO A FACT LEAVES A VERSION — against a real database.
 *
 * Codex reviewed stage 1 and found that only admission recorded history: an edit, a merge, an
 * accepted review or a deletion changed what a record says and appended nothing, so a held
 * import stayed "retracted" forever and the current version was not the current state. These
 * tests are that hole, closed at the repository so no caller can skip it.
 *
 * Requires FADI_TEST_DATABASE_URL pointed at a database this may modify.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("my career: history of every change", () => {
  let pool: import("pg").Pool;
  let evidence: ReturnType<typeof import("@careeros/database").createEvidenceRepository>;
  let career: ReturnType<typeof import("@careeros/database").createCareerCoreRepository>;
  let userId: string;

  const item = (over: Record<string, unknown> = {}) => ({
    kind: "experience",
    title: "IT Support Specialist",
    organization: "Crozaint Technologies",
    period: "2024",
    detail: "Supported Windows and Linux users.",
    origin: "manual",
    isCanonical: true,
    reviewStatus: "accepted",
    ...over,
  });

  beforeAll(async () => {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const db = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    const client = drizzle(pool) as never;
    evidence = db.createEvidenceRepository(client);
    career = db.createCareerCoreRepository(client);
    const { rows } = await pool.query(`insert into users (email) values ($1) returning id`, [
      `history-${Date.now()}@example.test`,
    ]);
    userId = rows[0].id as string;
  }, 60_000);

  beforeEach(async () => {
    await pool.query(`delete from evidence_items where user_id = $1`, [userId]);
    await pool.query(`delete from career_record_versions where user_id = $1`, [userId]);
  });

  afterAll(async () => {
    if (userId) await pool.query(`delete from users where id = $1`, [userId]);
    await pool?.end();
  });

  it("an edit appends the corrected state instead of overwriting it", async () => {
    const row = await evidence.create(userId, item({ factId: undefined }) as never);
    await evidence.update(userId, row.id, { title: "IT Systems Administrator" });

    const history = await career.listFactVersions(userId, row.factId ?? row.id);
    expect(history.map((v) => v.snapshot.title)).toContain("IT Systems Administrator");
    const current = await career.currentFactVersion(userId, row.factId ?? row.id);
    expect(current?.snapshot.title).toBe("IT Systems Administrator");
    expect(current?.status).toBe("active");
  });

  it("THE FIX: accepting a held import stops its history saying retracted", async () => {
    const pending = await evidence.create(
      userId,
      item({ reviewStatus: "pending", detail: "Ran the service desk." }) as never
    );
    const { recordFactState } = await import("@careeros/database");
    const db = (await import("drizzle-orm/node-postgres")).drizzle(pool) as never;
    await recordFactState(db, userId, pending); // what admission records for a held import
    expect((await career.currentFactVersion(userId, pending.id))?.status).toBe("retracted");

    await evidence.keepSeparate(userId, pending.id, pending.id);

    const current = await career.currentFactVersion(userId, pending.id);
    expect(current?.status).toBe("active");
    expect(current?.snapshot.detail).toBe("Ran the service desk.");
  });

  it("merging retires the absorbed fact and keeps what it said", async () => {
    const keep = await evidence.create(userId, item() as never);
    const absorbed = await evidence.create(
      userId,
      item({ detail: "Second-line support for 400 staff." }) as never
    );

    await evidence.mergeInto(userId, keep.id, absorbed.id);

    const retired = await career.currentFactVersion(userId, absorbed.id);
    expect(retired?.status).toBe("retracted");
    expect(retired?.snapshot.detail).toBe("Second-line support for 400 staff.");
    expect((await career.currentFactVersion(userId, keep.id))?.status).toBe("active");
  });

  it("undoing a merge gives the record its own history again", async () => {
    const keep = await evidence.create(userId, item() as never);
    const absorbed = await evidence.create(userId, item({ detail: "Other wording." }) as never);
    await evidence.mergeInto(userId, keep.id, absorbed.id);

    await evidence.splitOut(userId, absorbed.id);

    const again = await career.currentFactVersion(userId, absorbed.id);
    expect(again?.status).toBe("active");
    expect(again?.snapshot.detail).toBe("Other wording.");
  });

  it("deleting the last record ends its history with what it last said", async () => {
    const row = await evidence.create(userId, item() as never);
    await evidence.update(userId, row.id, { detail: "Rebuilt the imaging process." });

    await evidence.delete(userId, row.id);

    const last = await career.currentFactVersion(userId, row.id);
    expect(last?.status).toBe("retracted");
    expect(last?.snapshot.detail).toBe("Rebuilt the imaging process.");
    expect(await evidence.getForUser(userId, row.id)).toBeNull();
  });

  it("discarding a held import keeps the fact that it arrived", async () => {
    const pending = await evidence.create(
      userId,
      item({ reviewStatus: "pending", detail: "An import nobody wanted." }) as never
    );

    expect(await evidence.discardPending(userId, pending.id)).toBe(true);

    const last = await career.currentFactVersion(userId, pending.id);
    expect(last?.status).toBe("retracted");
    expect(last?.snapshot.detail).toBe("An import nobody wanted.");
  });

  it("editing one wording does not rewrite the fact's history with it", async () => {
    const leader = await evidence.create(userId, item() as never);
    const rendering = await evidence.create(
      userId,
      item({ isCanonical: false, factId: leader.id, detail: "Written for a SOC application." }) as never
    );

    await evidence.update(userId, rendering.id, { detail: "Reworded for a SOC application." });

    const current = await career.currentFactVersion(userId, leader.id);
    expect(current?.snapshot.detail).toBe("Supported Windows and Linux users.");
    expect(current?.snapshot.evidenceItemId).toBe(leader.id);
  });
});
