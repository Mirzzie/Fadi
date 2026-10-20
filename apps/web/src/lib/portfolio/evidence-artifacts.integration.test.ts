import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("Evidence-owned portfolio proof", () => {
  let pool: import("pg").Pool;
  let userId: string;
  let siteId: string;
  let evidenceId: string;

  beforeAll(async () => {
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: URL });
    userId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        "proof-" + Date.now() + "@example.test",
      ])
    ).rows[0].id;
    siteId = (
      await pool.query(
        "insert into portfolio_sites (user_id, handle, title) values ($1,$2,'Proof') returning id",
        [userId, "proof-" + Date.now()]
      )
    ).rows[0].id;
    evidenceId = (
      await pool.query(
        "insert into evidence_items " +
          "(user_id, kind, title, detail, origin, fact_id, is_canonical, review_status, attribution) " +
          "values ($1,'project','A real project','Built it.','manual',gen_random_uuid(),true,'accepted','personal') " +
          "returning id",
        [userId]
      )
    ).rows[0].id;
    await pool.query("update evidence_items set fact_id=id where id=$1", [evidenceId]);
  });

  afterAll(async () => {
    if (userId) await pool.query("delete from users where id=$1", [userId]);
    await pool?.end();
  });

  it("keeps proof after its portfolio presentation is deleted", async () => {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { createEvidenceArtifactsRepository, createPortfolioRepository } =
      await import("@careeros/database");
    const db = drizzle(pool) as never;
    const portfolio = createPortfolioRepository(db);
    const artifacts = createEvidenceArtifactsRepository(db);
    const item = await portfolio.createItem(userId, {
      siteId,
      evidenceItemId: evidenceId,
      section: "project",
      title: "Portfolio wording",
      imageUrl: "https://example.test/cover.jpg",
      gallery: ["https://example.test/demo.mp4"],
      url: "https://github.com/example/project",
      isPublished: true,
    });

    await artifacts.addForFact(userId, evidenceId, [
      {
        kind: "image",
        url: item.imageUrl!,
        label: "Cover",
        sortOrder: 0,
        sourcePortfolioItemId: item.id,
      },
      {
        kind: "video",
        url: item.gallery[0],
        label: "Gallery",
        sortOrder: 1,
        sourcePortfolioItemId: item.id,
      },
      {
        kind: "repository",
        url: item.url!,
        label: "Source",
        sortOrder: 1000,
        sourcePortfolioItemId: item.id,
      },
    ]);
    await artifacts.addForFact(userId, evidenceId, [
      {
        kind: "image",
        url: item.imageUrl!,
        label: "Cover",
        sortOrder: 0,
        sourcePortfolioItemId: item.id,
      },
    ]);
    expect(await artifacts.listForFacts(userId, [evidenceId])).toHaveLength(3);

    await portfolio.deleteItem(userId, item.id);
    const kept = await artifacts.listForFacts(userId, [evidenceId]);
    expect(kept).toHaveLength(3);
    expect(kept.every((artifact) => artifact.sourcePortfolioItemId === null)).toBe(true);
  });

  it("enforces one projection of a fact per site", async () => {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { createPortfolioRepository } = await import("@careeros/database");
    const portfolio = createPortfolioRepository(drizzle(pool) as never);
    await portfolio.createItem(userId, {
      siteId,
      evidenceItemId: evidenceId,
      section: "project",
      title: "First projection",
      isPublished: true,
    });
    await expect(
      portfolio.createItem(userId, {
        siteId,
        evidenceItemId: evidenceId,
        section: "project",
        title: "Duplicate projection",
        isPublished: true,
      })
    ).rejects.toThrow();
  });
});
