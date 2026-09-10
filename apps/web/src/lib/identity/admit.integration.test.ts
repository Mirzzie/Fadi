import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * THE REAL FUNCTIONS, AGAINST A REAL POSTGRES.
 *
 * Codex's fairest criticism of my first attempt: canonical-invariant.test.ts exercises a
 * locally reimplemented `merge`, so it proves my MODEL is right and cannot detect a
 * regression confined to production code. It also never executed D03 or D04 at all.
 *
 * This calls `admitEvidenceBatch` and `mergeInto` themselves, against a throwaway
 * database created from the real migrations — so it covers the SQL, the transaction and
 * the uuid columns that the synthetic seams could not.
 *
 * Skipped unless FADI_TEST_DATABASE_URL is set, because a unit suite must not require a
 * database to run. Set it to a URL the test may DROP AND RECREATE.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

const CANON = `select coalesce(fact_id, id) as fact, count(*) filter (where is_canonical) as canon
               from evidence_items group by 1`;

suite("admission against a real database", () => {
  let db: Awaited<ReturnType<typeof open>>;
  let userId: string;

  async function open() {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: URL });
    return { pool, orm: drizzle(pool) };
  }

  beforeAll(async () => {
    db = await open();
    // A user row to own the evidence; everything cascades from it.
    const { rows } = await db.pool.query(
      `insert into users (email) values ($1) returning id`,
      [`admit-test-${Date.now()}@example.test`],
    );
    userId = rows[0].id;
  }, 60_000);

  afterAll(async () => {
    if (!db) return;
    await db.pool.query(`delete from users where id = $1`, [userId]).catch(() => {});
    await db.pool.end();
  });

  it("D04b: one machine row then TWO matching human versions leaves exactly one canonical", async () => {
    // The case Codex reproduced after my first fix. Planning kept pointing both human
    // versions at the original machine row, so both were promoted and it was demoted
    // twice — two canonical rows for one fact.
    const { admitEvidenceBatch } = await import("./admit");

    // SEED A CORPUS FIRST. Rarity is measured against the user's own pool, so three
    // near-identical documents make every term appear in 100% of them and nothing is
    // distinctive — the matcher then reads all three as unrelated and the promotion
    // path is never reached. That is a real, documented property of the design, and it
    // is why Codex reproduced D04b with a stubbed matcher. Seeding unrelated work gives
    // IDF something to work with so the REAL matcher runs.
    await admitEvidenceBatch(userId, [
      { kind: "project", title: "OpenClaw Home SOC", detail: "Wazuh and Suricata on Proxmox VE.", origin: "ai" },
      { kind: "project", title: "Self-Hosted Nextcloud", detail: "Private file sync on a Raspberry Pi.", origin: "ai" },
      { kind: "project", title: "n8n Cyber-News Pipeline", detail: "Workflow summarising security news.", origin: "ai" },
      { kind: "project", title: "WordPress on AWS", detail: "EC2 stack provisioned with Ansible.", origin: "ai" },
      { kind: "experience", title: "IT Support Consultant", organization: "Spark Technomedia", detail: "Helpdesk tickets, Linux fixes.", origin: "ai" },
      { kind: "project", title: "Active Directory Lab", detail: "Windows domain with group policy and DNS.", origin: "ai" },
    ]);

    const base = {
      kind: "project",
      title: "Shield-Right DevSecOps",
      organization: "MSc Dissertation",
      detail: "Runtime protection and drift detection, IAST vs RASP on OWASP Juice Shop.",
    };
    await admitEvidenceBatch(userId, [
      { ...base, origin: "ai" },
      { ...base, detail: `${base.detail} Measured under load.`, origin: "upload" },
      { ...base, detail: `${base.detail} Rewritten again for a second application.`, origin: "upload" },
    ]);

    // ASSERT THE WORK HAPPENED FIRST. My previous version asserted only "no fact has a
    // canonical count other than one", which passes trivially when nothing was written
    // at all — and it did pass with the fix reverted, proving it tested nothing. A test
    // that cannot fail is worse than no test, because it is counted as coverage.
    const { rows: all } = await db.pool.query(
      `select count(*)::int as n from evidence_items where user_id = $1`,
      [userId],
    );
    expect(all[0].n).toBe(9); // 6 seeded + 3 versions of the dissertation

    // All three must resolve onto ONE fact — otherwise the promotion path was never
    // exercised and the canonical count below proves nothing.
    const { rows: facts } = await db.pool.query(
      `select coalesce(fact_id, id) as fact, count(*)::int as rows,
              count(*) filter (where is_canonical)::int as canon
         from evidence_items where user_id = $1 group by 1`,
      [userId],
    );
    // Every fact must have exactly one canonical — and the dissertation's three
    // versions must have collapsed onto ONE fact, or the promotion path never ran.
    for (const f of facts) expect(f.canon).toBe(1);
    const grouped = facts.find((f) => f.rows === 3);
    expect(grouped, "the three dissertation versions should share one fact").toBeDefined();
  }, 60_000);

  it("mergeInto keeps exactly one canonical when both rows are fresh (D01)", async () => {
    const { createEvidenceRepository } = await import("@careeros/database");
    const repo = createEvidenceRepository(db.orm as never);
    const a = await repo.create(userId, { kind: "project", title: "Nextcloud A", detail: "x" } as never);
    const b = await repo.create(userId, { kind: "project", title: "Nextcloud B", detail: "x" } as never);

    await repo.mergeInto(userId, a.id, b.id);

    const { rows } = await db.pool.query(
      `select count(*) filter (where is_canonical) as canon from evidence_items
       where coalesce(fact_id, id) = $1`,
      [a.id],
    );
    expect(Number(rows[0].canon)).toBe(1);
  }, 60_000);

  it("mergeInto is idempotent — a repeated request never empties the fact (D02)", async () => {
    const { createEvidenceRepository } = await import("@careeros/database");
    const repo = createEvidenceRepository(db.orm as never);
    const a = await repo.create(userId, { kind: "project", title: "Repeat A", detail: "y" } as never);
    const b = await repo.create(userId, { kind: "project", title: "Repeat B", detail: "y" } as never);

    await repo.mergeInto(userId, a.id, b.id);
    await repo.mergeInto(userId, a.id, b.id);

    const { rows } = await db.pool.query(
      `select count(*) filter (where is_canonical) as canon from evidence_items
       where coalesce(fact_id, id) = $1`,
      [a.id],
    );
    expect(Number(rows[0].canon)).toBe(1);
  }, 60_000);

  it("no fact anywhere in this user's pool ends with zero or two canonicals", async () => {
    // The invariant stated directly, over whatever the tests above left behind.
    const { rows } = await db.pool.query(
      `${CANON} having count(*) filter (where is_canonical) <> 1`,
    );
    expect(rows).toEqual([]);
  }, 60_000);
});
