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
