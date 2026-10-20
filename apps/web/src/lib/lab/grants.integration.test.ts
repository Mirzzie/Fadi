import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * PERMISSION, AGAINST A REAL DATABASE.
 *
 * The broker's unit tests mock the grant lookup away, which is right for testing the
 * gate's logic and useless for testing the gate's *answer*. Everything that decides
 * whether Fadi may touch this machine — expiry, revocation, scoping to one capability,
 * scoping to one resource, scoping to one user — is a WHERE clause. A mocked repository
 * agrees with whatever the clause says, including a clause that is wrong.
 *
 * Expiry is the one that would hurt most quietly. If `expires_at` were compared in the
 * wrong direction, or the comparison sat outside the `and()`, every permission the user
 * ever gave would still be live and nothing would look broken.
 *
 * Requires FADI_TEST_DATABASE_URL pointed at a database this may modify.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

/** Not in the broker's catalogue, so a running app cannot grant it underneath the test. */
const CAP = "verify.only";

suite("a grant decides whether Fadi may act", () => {
  let pool: import("pg").Pool;
  let orm: ReturnType<typeof import("drizzle-orm/node-postgres").drizzle>;
  let grants: ReturnType<typeof import("@careeros/database").createLabGrantsRepository>;
  let userId: string;

  beforeAll(async () => {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const { createLabGrantsRepository } = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    orm = drizzle(pool);
    grants = createLabGrantsRepository(orm as never);

    const { rows } = await pool.query(`insert into users (email) values ($1) returning id`, [
      `grant-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
    ]);
    userId = rows[0].id as string;
  }, 60_000);

  afterAll(async () => {
    if (userId) await pool.query(`delete from users where id = $1`, [userId]);
    await pool?.end();
  });

  // Each test starts from "nothing is allowed". Without this, a grant made by an earlier
  // test stays live and the next one passes for the wrong reason — the failure mode that
  // hid the overlapping-grant bug below until this suite ran against real Postgres.
  beforeEach(async () => {
    await pool.query(`delete from lab_grants where user_id = $1`, [userId]);
  });

  it("denies when nothing was granted", async () => {
    expect(await grants.findLive(userId, CAP)).toBeNull();
  });

  it("allows exactly what was granted, and nothing adjacent", async () => {
    const g = await grants.grant({ userId, capability: CAP, minutes: 60, reason: "test" });

    expect((await grants.findLive(userId, CAP))?.id).toBe(g.id);
    // A grant to inspect containers is not a grant to inspect the hypervisor.
    expect(await grants.findLive(userId, CAP + ".other")).toBeNull();
    // A grant on THIS machine is not a wildcard over every registered resource.
    expect(await grants.findLive(userId, CAP, g.id)).toBeNull();
  });

  it("EXPIRES ON ITS OWN, with no sweeper running", async () => {
    const g = await grants.grant({ userId, capability: CAP, minutes: 60, reason: "test" });
    await pool.query(`update lab_grants set expires_at = now() - interval '1 minute' where id = $1`, [g.id]);

    // Nothing ran in between. The clause reads the clock, so the permission is simply
    // gone — which is what makes "expires on its own" a real promise rather than a note
    // in the UI.
    expect(await grants.findLive(userId, CAP)).toBeNull();
  });

  it("revocation takes effect immediately and keeps the history", async () => {
    const g = await grants.grant({ userId, capability: CAP, minutes: 60, reason: "test" });
    await grants.revokeCapability(userId, CAP);

    expect(await grants.findLive(userId, CAP)).toBeNull();
    // "I allowed this and took it back" is the history someone needs when working out
    // what happened. A DELETE would erase exactly that.
    const kept = (await grants.listForUser(userId)).find((r) => r.id === g.id);
    expect(kept).toBeDefined();
    expect(kept?.revokedAt).not.toBeNull();
  });

  it("THE BUG: allowing twice and revoking once must not leave access open", async () => {
    // Grants accumulate — allow, let it lapse, allow again. findLive answers with the
    // newest, so revoking a single row by id closed the one the panel was showing and
    // left an older one still permitting access, behind a UI reading "not allowed".
    await grants.grant({ userId, capability: CAP, minutes: 60, reason: "first" });
    await grants.grant({ userId, capability: CAP, minutes: 60, reason: "second" });

    const closed = await grants.revokeCapability(userId, CAP);
    expect(closed).toBe(2);
    expect(await grants.findLive(userId, CAP)).toBeNull();
  });

  it("revoking everything closes every live grant at once", async () => {
    await grants.grant({ userId, capability: CAP, minutes: 60, reason: "test" });
    await grants.grant({ userId, capability: CAP + ".two", minutes: 60, reason: "test" });

    const revoked = await grants.revokeAll(userId);
    expect(revoked).toBeGreaterThanOrEqual(2);
    expect(await grants.findLive(userId, CAP)).toBeNull();
    expect(await grants.findLive(userId, CAP + ".two")).toBeNull();
  });

  it("one person's permission is not another's", async () => {
    const { rows } = await pool.query(`insert into users (email) values ($1) returning id`, [
      `grant-other-${Date.now()}@example.test`,
    ]);
    const otherId = rows[0].id as string;
    try {
      await grants.grant({ userId: otherId, capability: CAP, minutes: 60, reason: "test" });
      expect(await grants.findLive(userId, CAP)).toBeNull();
    } finally {
      await pool.query(`delete from users where id = $1`, [otherId]);
    }
  });
});
