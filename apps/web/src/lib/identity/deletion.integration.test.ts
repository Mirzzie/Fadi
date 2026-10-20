import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * DELETION, AGAINST A REAL DATABASE.
 *
 * D07 is a promise about what is gone, and a promise about SQL cascade behaviour cannot
 * be checked with a mock — the whole finding IS the cascade rule. `product_events` is
 * the one table set to ON DELETE SET NULL, so its rows outlive the user with `user_id`
 * emptied, carrying whatever the payload held: which work was opened, the visitor's city
 * and network, and for feedback the message text and the email address a stranger left.
 *
 * Requires FADI_TEST_DATABASE_URL pointed at a database this may modify.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("deleting a user's data", () => {
  let pool: import("pg").Pool;
  let orm: ReturnType<typeof import("drizzle-orm/node-postgres").drizzle>;

  beforeAll(async () => {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: URL });
    orm = drizzle(pool);
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
  });

  async function seedUserWithEvents() {
    const { rows } = await pool.query(`insert into users (email) values ($1) returning id`, [
      `del-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
    ]);
    const userId = rows[0].id as string;
    await pool.query(
      `insert into product_events (user_id, event_type, payload) values
         ($1,'portfolio.feedback',$2),
         ($1,'portfolio.view',$3)`,
      [
        userId,
        // A third party's words and contact details — the part that must not survive.
        JSON.stringify({ message: "Loved the Home SOC write-up", contact: "someone@example.com", from: "A visitor" }),
        JSON.stringify({ visitor: "abc123", city: "Dublin", country: "IE", org: "Acme Corp" }),
      ],
    );
    return userId;
  }

  it("THE BUG: a third party's feedback and email must not outlive the account", async () => {
    const { createUsersRepository } = await import("@careeros/database");
    const userId = await seedUserWithEvents();

    await createUsersRepository(orm as never).deleteById(userId);

    // The rows may survive as anonymous counts — that is what SET NULL is for — but
    // nothing identifying may remain in them.
    const { rows } = await pool.query(
      `select payload::text as p from product_events where payload::text ilike '%example.com%'
          or payload::text ilike '%Acme Corp%' or payload::text ilike '%Home SOC%'`,
    );
    expect(rows).toEqual([]);
  }, 60_000);

  it("keeps the anonymous count, because that is what the orphaned row is for", async () => {
    const { createUsersRepository } = await import("@careeros/database");
    const before = await pool.query(`select count(*)::int as n from product_events`);
    const userId = await seedUserWithEvents();

    await createUsersRepository(orm as never).deleteById(userId);

    const after = await pool.query(`select count(*)::int as n from product_events`);
    // Two rows added, two rows still present — redacted, not deleted.
    expect(after.rows[0].n).toBe(before.rows[0].n + 2);
    const orphaned = await pool.query(
      `select count(*)::int as n from product_events where user_id is null and payload = '{}'::jsonb`,
    );
    expect(orphaned.rows[0].n).toBeGreaterThanOrEqual(2);
  }, 60_000);

  it("closing the account redacts too — it is the stricter promise", async () => {
    const { createUsersRepository } = await import("@careeros/database");
    const userId = await seedUserWithEvents();

    await createUsersRepository(orm as never).closeAccount(userId);

    const { rows } = await pool.query(
      `select payload::text as p from product_events where payload::text ilike '%example.com%'`,
    );
    expect(rows).toEqual([]);
  }, 60_000);
});

/**
 * D09 — a deletion made of several independent writes.
 *
 * Deleting a direction removed its tailored résumé, then its report, then the direction
 * itself. A failure on the last left the user without the derived artefacts while still
 * holding the direction that explained them — and the reverse leaves an untagged résumé,
 * which becomes the shared fallback and silently poisons every other direction.
 */
suite("deleting a direction is all-or-nothing", () => {
  let pool: import("pg").Pool;
  let orm: ReturnType<typeof import("drizzle-orm/node-postgres").drizzle>;

  beforeAll(async () => {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: URL });
    orm = drizzle(pool);
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
  });

  it("rolls the résumé and report back when the track is not ours", async () => {
    const { rows } = await pool.query(`insert into users (email) values ($1) returning id`, [
      `d09-${Date.now()}@example.test`,
    ]);
    const userId = rows[0].id as string;
    const { rows: t } = await pool.query(
      `insert into career_profiles (user_id, target_role, career_goal) values ($1,'SOC Analyst','x') returning id`,
      [userId],
    );
    const trackId = t[0].id as string;
    await pool.query(
      `insert into resumes (user_id, career_profile_id, parse_status) values ($1,$2,'manual_text')`,
      [userId, trackId],
    );

    // Someone else's id: the delete must fail AND leave the résumé intact.
    const { createResumesRepository, createCareerReportsRepository, createCareerProfilesRepository } =
      await import("@careeros/database");
    const stranger = "00000000-0000-0000-0000-000000000000";
    await orm
      .transaction(async (tx) => {
        await createResumesRepository(tx as never).deleteForTrack(stranger, trackId);
        await createCareerReportsRepository(tx as never).deleteForTrack(stranger, trackId);
        const ok = await createCareerProfilesRepository(tx as never).deleteForUser(stranger, trackId);
        if (!ok) throw new Error("not ours");
      })
      .catch(() => undefined);

    const after = await pool.query(`select count(*)::int as n from resumes where career_profile_id = $1`, [trackId]);
    expect(after.rows[0].n).toBe(1);

    await pool.query(`delete from users where id = $1`, [userId]);
  }, 60_000);
});
