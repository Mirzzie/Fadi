import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * A DELETED RECORD MUST NOT LEAVE A LIVE CLAIM BEHIND — against a real database.
 *
 * The foreign key nulls `evidence_item_id` when evidence is deleted, so the marker has to be
 * written inside that same transaction. A mock cannot show that, because the thing being tested
 * IS the database's own cascade.
 *
 * Requires FADI_TEST_DATABASE_URL pointed at a database this may modify.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("deleting evidence marks the portfolio items it was holding up", () => {
  let pool: import("pg").Pool;
  let userId: string;
  let siteId: string;

  beforeAll(async () => {
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: URL });
    const email = `unbacked-${Date.now()}@example.test`;
    userId = (await pool.query(`insert into users (email) values ($1) returning id`, [email])).rows[0].id;
    siteId = (
      await pool.query(
        `insert into portfolio_sites (user_id, handle, title, is_published) values ($1,$2,'Site',true) returning id`,
        [userId, `unbacked-${Date.now()}`]
      )
    ).rows[0].id;
  }, 60_000);

  afterAll(async () => {
    if (userId) await pool.query(`delete from users where id = $1`, [userId]);
    await pool?.end();
  });

  const seed = async (title: string, published: boolean) => {
    const evidenceId = (
      await pool.query(
        `insert into evidence_items (user_id, kind, title, period, detail, origin, is_canonical, review_status, attribution)
         values ($1,'project',$2,'2026','Detail.','manual',true,'accepted','personal') returning id`,
        [userId, title]
      )
    ).rows[0].id as string;
    await pool.query(`update evidence_items set fact_id = id where id = $1`, [evidenceId]);
    const itemId = (
      await pool.query(
        `insert into portfolio_items (user_id, site_id, evidence_item_id, section, title, is_published)
         values ($1,$2,$3,'project',$4,$5) returning id`,
        [userId, siteId, evidenceId, title, published]
      )
    ).rows[0].id as string;
    return { evidenceId, itemId };
  };

  const itemRow = async (id: string) =>
    (
      await pool.query(
        `select evidence_item_id, unbacked_since from portfolio_items where id = $1`,
        [id]
      )
    ).rows[0];

  it("stamps the live item, keeps the page unchanged, and the drift check sees it", async () => {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { createEvidenceRepository } = await import("@careeros/database");
    const { portfolioFreshness } = await import("./freshness");
    const { evidenceId, itemId } = await seed("Network monitoring lab", true);

    await createEvidenceRepository(drizzle(pool) as never).delete(userId, evidenceId);

    const row = await itemRow(itemId);
    expect(row.evidence_item_id).toBeNull(); // the database severed the link
    expect(row.unbacked_since).not.toBeNull(); // and this is what remembers

    const drift = portfolioFreshness(
      [
        {
          id: itemId,
          title: "Network monitoring lab",
          evidenceItemId: row.evidence_item_id,
          isPublished: true,
          updatedAt: new Date(),
          unbackedSince: row.unbacked_since,
        },
      ],
      []
    );
    expect(drift.withdrawn).toEqual([{ id: itemId, title: "Network monitoring lab" }]);

    // The item itself is untouched: a public page is the owner's, and this is a decision to put
    // to them, not an unpublish.
    const still = await pool.query(`select is_published, title from portfolio_items where id = $1`, [itemId]);
    expect(still.rows[0]).toMatchObject({ is_published: true, title: "Network monitoring lab" });
  });

  it("leaves an unpublished draft unmarked — nobody can read it", async () => {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { createEvidenceRepository } = await import("@careeros/database");
    const { evidenceId, itemId } = await seed("A draft", false);

    await createEvidenceRepository(drizzle(pool) as never).delete(userId, evidenceId);

    expect((await itemRow(itemId)).unbacked_since).toBeNull();
  });
});
