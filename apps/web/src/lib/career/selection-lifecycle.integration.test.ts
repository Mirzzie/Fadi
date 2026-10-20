import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * A CHOICE SURVIVES A MERGE ONLY WHERE IT STILL MEANS SOMETHING — against a real database.
 *
 * Codex's S2-R5: Include/Exclude choices are keyed by fact id, and merging leaves one of those
 * ids standing for nothing. Transferring an exclusion made about a DIFFERENT record would invent
 * a decision; keeping an orphan row would quietly steer documents for a fact nobody can see.
 *
 * Requires FADI_TEST_DATABASE_URL pointed at a database this may modify.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("include/exclude choices through merge and deletion", () => {
  let pool: import("pg").Pool;
  let evidence: ReturnType<typeof import("@careeros/database").createEvidenceRepository>;
  let userId: string;
  const scope = "direction:11111111-1111-4111-8111-111111111111";

  const addRecord = async (title: string, detail: string) => {
    const row = await evidence.create(userId, {
      kind: "experience",
      title,
      organization: "Crozaint Technologies",
      period: "2024",
      detail,
      origin: "manual",
      isCanonical: true,
      reviewStatus: "accepted",
    } as never);
    await pool.query(`update evidence_items set fact_id = id where id = $1`, [row.id]);
    return { ...row, factId: row.id };
  };

  const choose = async (factId: string, mode: string) => {
    await pool.query(
      `insert into career_selections (user_id, scope, fact_id, mode) values ($1,$2,$3,$4)`,
      [userId, scope, factId, mode]
    );
  };

  const choices = async () =>
    (
      await pool.query(
        `select fact_id, mode from career_selections where user_id = $1 order by mode`,
        [userId]
      )
    ).rows;

  beforeAll(async () => {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const db = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    evidence = db.createEvidenceRepository(drizzle(pool) as never);
    userId = (
      await pool.query(`insert into users (email) values ($1) returning id`, [
        `selection-${Date.now()}@example.test`,
      ])
    ).rows[0].id;
  }, 60_000);

  beforeEach(async () => {
    await pool.query(`delete from career_selections where user_id = $1`, [userId]);
    await pool.query(`delete from evidence_items where user_id = $1`, [userId]);
  });

  afterAll(async () => {
    if (userId) await pool.query(`delete from users where id = $1`, [userId]);
    await pool?.end();
  });

  it("carries a choice over when the surviving record has none to disagree with", async () => {
    const keep = await addRecord("IT Support Specialist", "Windows and Linux.");
    const absorbed = await addRecord("Support Engineer", "Second-line support.");
    await choose(absorbed.factId, "include");

    const result = await evidence.mergeInto(userId, keep.id, absorbed.id);

    expect(result.moved).toEqual([scope]);
    expect(await choices()).toEqual([{ fact_id: keep.factId, mode: "include" }]);
  });

  it("THE POINT: two different decisions are both cleared, not silently merged", async () => {
    const keep = await addRecord("IT Support Specialist", "Windows and Linux.");
    const absorbed = await addRecord("Support Engineer", "Second-line support.");
    await choose(keep.factId, "include");
    await choose(absorbed.factId, "exclude");

    const result = await evidence.mergeInto(userId, keep.id, absorbed.id);

    expect(result.cleared).toEqual([scope]);
    // Back to Auto: neither decision was made about the record that now exists.
    expect(await choices()).toEqual([]);
  });

  it("keeps one row when both said the same thing", async () => {
    const keep = await addRecord("IT Support Specialist", "Windows and Linux.");
    const absorbed = await addRecord("Support Engineer", "Second-line support.");
    await choose(keep.factId, "exclude");
    await choose(absorbed.factId, "exclude");

    await evidence.mergeInto(userId, keep.id, absorbed.id);

    expect(await choices()).toEqual([{ fact_id: keep.factId, mode: "exclude" }]);
  });

  it("forgets a choice about a record that has been deleted outright", async () => {
    const row = await addRecord("IT Support Specialist", "Windows and Linux.");
    await choose(row.factId, "include");

    await evidence.delete(userId, row.id);

    expect(await choices()).toEqual([]);
  });

  it("keeps the choice when another wording still leads that fact", async () => {
    const leader = await addRecord("IT Support Specialist", "Windows and Linux.");
    const rendering = await evidence.create(userId, {
      kind: "experience",
      title: "IT Support Specialist",
      organization: "Crozaint Technologies",
      period: "2024",
      detail: "Written for a SOC application.",
      origin: "manual",
      isCanonical: false,
      factId: leader.factId,
      reviewStatus: "accepted",
    } as never);
    await choose(leader.factId, "include");

    await evidence.delete(userId, rendering.id);

    expect(await choices()).toEqual([{ fact_id: leader.factId, mode: "include" }]);
  });
});
