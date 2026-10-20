import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * A SAVED JOB STAYS SAVED WHEN ITS DUPLICATE WINS — against a real database.
 *
 * The same vacancy arrives from several boards and the reader keeps one row per canonical key.
 * Saved and applied state is looked up by ROW id, so if the person saved the Reed copy and the
 * reader keeps the Jooble copy, the card comes back unsaved — and an application in progress
 * disappears from the board.
 *
 * Requires FADI_TEST_DATABASE_URL pointed at a database this may modify.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("saved state across duplicate postings", () => {
  let pool: import("pg").Pool;
  let userId: string;
  let jobsRepo: ReturnType<typeof import("@careeros/database").createJobsRepository>;
  let savedRepo: ReturnType<typeof import("@careeros/database").createSavedJobsRepository>;

  beforeAll(async () => {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const db = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    const orm = drizzle(pool) as never;
    jobsRepo = db.createJobsRepository(orm);
    savedRepo = db.createSavedJobsRepository(orm);
    const { rows } = await pool.query(`insert into users (email) values ($1) returning id`, [
      `dupe-${Date.now()}@example.test`,
    ]);
    userId = rows[0].id as string;
  }, 60_000);

  afterAll(async () => {
    if (userId) await pool.query(`delete from users where id = $1`, [userId]);
    await pool?.end();
  });

  it("THE RISK: the same vacancy from two boards collapses to one row", async () => {
    // The ingest groups two boards onto ONE vacancy when it has verified identity (the same
    // apply link), by passing an explicit canonical key. Nine vacancies in the owner's live
    // database are grouped this way today.
    const key = `adecco|deskside support engineer|dublin|verified-${Date.now()}`;
    const reed = await jobsRepo.upsertSeedJob({
      source: "reed",
      externalId: `reed-${Date.now()}`,
      canonicalKey: key,
      title: "Deskside Support Engineer",
      company: "Adecco",
      location: "Dublin",
      description: "Support role.",
      url: "https://employer.example/apply/1",
    });
    const jooble = await jobsRepo.upsertSeedJob({
      source: "jooble",
      externalId: `jooble-${Date.now()}`,
      canonicalKey: key,
      title: "Deskside Support Engineer",
      company: "Adecco",
      location: "Dublin",
      description: "Support role, longer description from the second board.",
      url: "https://employer.example/apply/1",
    });

    // Same vacancy, so the same canonical key — that is the grouping under test.
    // Both boards land on one vacancy row, with both occurrences recorded against it.
    expect(jooble.id).toBe(reed.id);
    const { rows } = await pool.query(
      `select distinct source from job_occurrences where job_id = $1 order by source`,
      [reed.id]
    );
    expect(rows.map((r: { source: string }) => r.source)).toEqual(["jooble", "reed"]);

    // The person saves the vacancy.
    await savedRepo.saveForUser(userId, reed.id, {});

    const visible = await jobsRepo.listActiveForUser(userId);
    // Filter on THIS run's vacancy, not on the title: the jobs table is not user-scoped, so
    // every earlier run of this test left a row with the same title behind and the assertion
    // passed only against a database that had never seen it.
    const shown = visible.filter((j) => j.canonicalKey === key);
    expect(shown).toHaveLength(1);

    // The board finds the save on the vacancy, whichever board's copy it came from.
    const byCanonical = await savedRepo.listForUserByCanonicalKeys(
      userId,
      shown.map((j) => j.canonicalKey)
    );
    expect(byCanonical).toHaveLength(1);
    expect(byCanonical[0].canonicalKey).toBe(shown[0].canonicalKey);
  });
});
