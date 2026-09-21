import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Run only against an explicitly provisioned test database. Admission's application
// client and the assertions MUST use the same connection, never the developer's DB.
const url = process.env.FADI_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("production admission and review against Postgres", () => {
  let pool: import("pg").Pool;
  let repo: ReturnType<typeof import("@careeros/database").createEvidenceRepository>;
  let userId: string;
  const base = {
    kind: "experience",
    title: "Support engineer",
    organization: "Acme",
    attribution: "employment",
    period: "2024",
    detail: "Resolved tickets",
    origin: "upload",
  };
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== url || !new URL(url!).pathname.includes("identity_test_"))
      throw new Error("Use a dedicated identity_test_ database for both database URLs.");
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { createEvidenceRepository } = await import("@careeros/database");
    pool = new Pool({ connectionString: url });
    repo = createEvidenceRepository(drizzle(pool) as never);
    userId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `identity-${Date.now()}@example.test`,
      ])
    ).rows[0].id;
  });
  beforeEach(async () => {
    await pool.query("delete from evidence_items where user_id = $1", [userId]);
  });
  afterAll(async () => {
    if (!pool) return;
    await pool.query("delete from users where id = $1", [userId]);
    await pool.end();
    const state = globalThis as typeof globalThis & {
      careerosDatabase?: { pool: import("pg").Pool };
    };
    await state.careerosDatabase?.pool.end();
    delete state.careerosDatabase;
  });
  it("serialises concurrent exact reimports into one row", async () => {
    const { admitEvidence } = await import("./admit");
    const results = await Promise.all(Array.from({ length: 4 }, () => admitEvidence(userId, base)));
    expect(new Set(results.map((r) => r.row.id)).size).toBe(1);
    expect(await repo.listAllForUser(userId)).toHaveLength(1);
  });
  it("holds both rewrites outside canonical reads until a person resolves them", async () => {
    const { admitEvidenceBatch } = await import("./admit");
    const result = await admitEvidenceBatch(userId, [
      base,
      { ...base, detail: "Managed incidents" },
      { ...base, detail: "Handled client support" },
    ]);
    expect(result.created).toHaveLength(1);
    expect(result.uncertain).toBe(2);
    const all = await repo.listAllForUser(userId);
    expect(all).toHaveLength(3);
    expect(await repo.listForUser(userId)).toHaveLength(1);
    const pending = all.filter((r) => r.reviewStatus === "pending");
    await repo.mergeInto(userId, result.created[0].id, pending[0].id);
    await repo.mergeInto(userId, result.created[0].id, pending[0].id); // D01/D02 idempotency
    expect(await repo.listForUser(userId)).toHaveLength(1);
    expect(await repo.listRenderings(userId, result.created[0].id)).toHaveLength(1);
    expect((await repo.getForUser(userId, result.created[0].id))?.detail).toBe(base.detail);
  });
  it("exact replay of an archived variant returns the actual canonical row (D03)", async () => {
    const { admitEvidence } = await import("./admit");
    const a = await admitEvidence(userId, base);
    const variation = { ...base, detail: "A different wording" };
    const b = await admitEvidence(userId, variation);
    await repo.mergeInto(userId, a.row.id, b.row.id);
    const replay = await admitEvidence(userId, variation);
    expect(replay.row.id).toBe(a.row.id);
    expect(replay.row.isCanonical).toBe(true);
    expect(replay.row.detail).toBe(base.detail);
    expect(await repo.listAllForUser(userId)).toHaveLength(2);
  });
  it("persists a distinct decision and reuses that accepted variant on reimport", async () => {
    const { admitEvidence } = await import("./admit");
    const a = await admitEvidence(userId, base);
    const other = { ...base, organization: "Another company" };
    const b = await admitEvidence(userId, other);
    expect(b.row.reviewStatus).toBe("pending");
    await repo.keepSeparate(userId, b.row.id, a.row.id);
    expect(await repo.listForUser(userId)).toHaveLength(2);
    expect((await repo.getForUser(userId, a.row.id))?.distinctFrom).toContain(b.row.id);
    expect((await admitEvidence(userId, other)).row.id).toBe(b.row.id);
  });
  it("refuses cross-kind merges without changing either record", async () => {
    const { admitEvidence } = await import("./admit");
    const a = await admitEvidence(userId, base);
    const b = await admitEvidence(userId, { ...base, kind: "project" });
    await expect(repo.mergeInto(userId, a.row.id, b.row.id)).rejects.toThrow("Different kinds");
    expect(await repo.listForUser(userId)).toHaveLength(2);
  });
  it("rolls back the entire batch on a later write failure", async () => {
    const { admitEvidenceBatch } = await import("./admit");
    await expect(
      admitEvidenceBatch(userId, [base, { ...base, title: null as never }])
    ).rejects.toThrow();
    expect(await repo.listAllForUser(userId)).toHaveLength(0);
  });
  it("discards pending imports but a stale discard cannot remove accepted evidence", async () => {
    const { admitEvidence } = await import("./admit");
    const a = await admitEvidence(userId, base);
    const b = await admitEvidence(userId, { ...base, detail: "Wrong import" });
    expect(await repo.discardPending(userId, b.row.id)).toBe(true);
    expect(await repo.discardPending(userId, a.row.id)).toBe(false);
    expect(await repo.listAllForUser(userId)).toHaveLength(1);
  });
  it("repeated pending inputs report one visible review and do not multiply rows", async () => {
    const { admitEvidence, admitEvidenceBatch } = await import("./admit");
    await admitEvidence(userId, base);
    const candidate = { ...base, detail: "Changed wording" };
    const result = await admitEvidenceBatch(userId, [candidate, candidate]);
    expect(result.uncertain).toBe(1);
    expect(await repo.listAllForUser(userId)).toHaveLength(2);
  });
  it("participates in the caller's transaction without committing evidence early", async () => {
    const { admitEvidence } = await import("./admit");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    await expect(drizzle(pool).transaction(async tx => {
      await admitEvidence(userId, base, { db: tx as never });
      throw new Error("Caller failed after admission");
    })).rejects.toThrow("Caller failed");
    expect(await repo.listAllForUser(userId)).toHaveLength(0);
  });
  it("cannot resolve another owner's review", async () => {
    const { admitEvidence } = await import("./admit");
    const a = await admitEvidence(userId, base);
    await expect(
      repo.keepSeparate("00000000-0000-4000-8000-000000000000", a.row.id, a.row.id)
    ).rejects.toThrow();
    expect((await repo.getForUser(userId, a.row.id))?.detail).toBe(base.detail);
  });
});
