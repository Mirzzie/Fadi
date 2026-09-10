import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("job occurrence identity", () => {
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

  it("D12: separates same-title requisitions and accepts a newer shorter correction", async () => {
    const { createJobsRepository } = await import("@careeros/database");
    const repo = createJobsRepository(orm as never);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const base = {
      source: `d12-${suffix}`,
      company: "Example Operations",
      title: "Support Engineer",
      location: "Dublin",
      status: "active",
    };

    const first = await repo.upsertSeedJob({
      ...base,
      externalId: "req-1",
      description: "A long initial description which is later corrected by the source.",
    });
    const second = await repo.upsertSeedJob({
      ...base,
      externalId: "req-2",
      description: "A separate requisition.",
    });
    const corrected = await repo.upsertSeedJob({
      ...base,
      externalId: "req-1",
      title: "IT Support Engineer",
      description: "Corrected.",
    });

    expect(second.id).not.toBe(first.id);
    expect(corrected.id).toBe(first.id);
    expect(corrected.title).toBe("IT Support Engineer");
    expect(corrected.description).toBe("Corrected.");

    await pool.query(`delete from jobs where source = $1`, [base.source]);
  }, 60_000);
});
