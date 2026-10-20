import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * DETECTION MUST NOT ACCUMULATE.
 *
 * Found by running the app rather than by any test: clicking "detect what's on this
 * machine" three times produced three identical rows for the same laptop, and placement
 * then answered "unmeasured: This machine, This machine, This machine". An inventory that
 * grows every time you look at it is not an inventory.
 *
 * Requires FADI_TEST_DATABASE_URL.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("the machine registry reconciles rather than appends", () => {
  let pool: import("pg").Pool;
  let repo: ReturnType<typeof import("@careeros/database").createLabResourcesRepository>;
  let userId: string;

  const laptop = {
    label: "This machine (Docker)",
    kind: "laptop" as const,
    arch: "x86_64" as const,
    virtualization: "containers" as const,
    memoryMb: 23437,
    diskGb: 41,
    alwaysOn: false,
    notes: "Docker Engine 29.7.2 is running here.",
    scopes: ["read"],
  };

  beforeAll(async () => {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const { createLabResourcesRepository } = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    repo = createLabResourcesRepository(drizzle(pool) as never);
    const { rows } = await pool.query(`insert into users (email) values ($1) returning id`, [
      `reg-${Date.now()}@example.test`,
    ]);
    userId = rows[0].id as string;
  }, 60_000);

  afterAll(async () => {
    if (userId) await pool.query(`delete from users where id = $1`, [userId]);
    await pool?.end();
  });

  beforeEach(async () => {
    await pool.query(`delete from lab_resources where user_id = $1`, [userId]);
  });

  it("THE BUG: detecting the same machine three times records it once", async () => {
    await repo.upsertDetected(userId, laptop as never);
    await repo.upsertDetected(userId, laptop as never);
    await repo.upsertDetected(userId, laptop as never);

    const all = await repo.listForUser(userId);
    expect(all).toHaveLength(1);
    expect(all[0].memoryMb).toBe(23437);
  });

  it("keeps the id stable, so anything pointing at the machine still points at it", async () => {
    const first = await repo.upsertDetected(userId, laptop as never);
    const again = await repo.upsertDetected(userId, laptop as never);
    // A project planned against this host must not be orphaned by a second detection.
    expect(again.id).toBe(first.id);
  });

  it("updates what it now knows", async () => {
    await repo.upsertDetected(userId, { ...laptop, memoryMb: null, diskGb: null } as never);
    await repo.upsertDetected(userId, laptop as never);

    const [row] = await repo.listForUser(userId);
    expect(row.memoryMb).toBe(23437);
    expect(row.diskGb).toBe(41);
  });

  it("NEVER erases a measurement with a blank one", async () => {
    // A detection run without host access knows LESS than the row it is updating. Letting
    // it overwrite memory with null would make the registry worse every time someone
    // declined a permission — which is the opposite of what declining should cost.
    await repo.upsertDetected(userId, laptop as never);
    await repo.upsertDetected(userId, { ...laptop, memoryMb: null, diskGb: null } as never);

    const [row] = await repo.listForUser(userId);
    expect(row.memoryMb).toBe(23437);
    expect(row.diskGb).toBe(41);
  });

  it("keeps genuinely different machines apart", async () => {
    await repo.upsertDetected(userId, laptop as never);
    await repo.upsertDetected(userId, { ...laptop, label: "Proxmox at 192.168.0.56" } as never);
    expect(await repo.listForUser(userId)).toHaveLength(2);
  });

  it("is scoped to one person's registry", async () => {
    const { rows } = await pool.query(`insert into users (email) values ($1) returning id`, [
      `reg-other-${Date.now()}@example.test`,
    ]);
    const otherId = rows[0].id as string;
    try {
      await repo.upsertDetected(userId, laptop as never);
      await repo.upsertDetected(otherId, laptop as never);
      expect(await repo.listForUser(userId)).toHaveLength(1);
      expect(await repo.listForUser(otherId)).toHaveLength(1);
    } finally {
      await pool.query(`delete from users where id = $1`, [otherId]);
    }
  });
});
