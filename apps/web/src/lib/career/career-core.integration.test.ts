import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * MY CAREER keeps what arrived and every state of a fact — against a real database.
 *
 * Both properties are transactional, so a mocked repository proves nothing: an import that
 * overwrites its predecessor and a correction that overwrites a fact are exactly the failures
 * being prevented.
 *
 * Requires FADI_TEST_DATABASE_URL pointed at a database this may modify.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("my career: sources and fact history", () => {
  let pool: import("pg").Pool;
  let repo: ReturnType<typeof import("@careeros/database").createCareerCoreRepository>;
  let userId: string;
  const factId = "11111111-1111-4111-8111-111111111111";

  const snapshot = (over: Record<string, unknown> = {}) => ({
    evidenceItemId: "22222222-2222-4222-8222-222222222222",
    kind: "experience",
    title: "IT Support Specialist",
    organization: "Crozaint Technologies",
    period: "2024",
    detail: "Supported Windows and Linux users.",
    metrics: null,
    tags: ["linux"],
    origin: "manual",
    ...over,
  });

  beforeAll(async () => {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const db = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    repo = db.createCareerCoreRepository(drizzle(pool) as never);
    const { rows } = await pool.query(`insert into users (email) values ($1) returning id`, [
      `career-${Date.now()}@example.test`,
    ]);
    userId = rows[0].id as string;
  }, 60_000);

  afterAll(async () => {
    if (userId) await pool.query(`delete from users where id = $1`, [userId]);
    await pool?.end();
  });

  it("an import is kept, and re-importing the same text reuses its version", async () => {
    const first = await repo.preserveSource(userId, {
      sourceKind: "resume",
      sourceKey: "track-1",
      content: "IT Support Specialist at Crozaint. Windows, Linux.",
    });
    expect(first.reused).toBe(false);
    expect(first.version.version).toBe(1);

    const again = await repo.preserveSource(userId, {
      sourceKind: "resume",
      sourceKey: "track-1",
      content: "IT Support Specialist at Crozaint. Windows, Linux.",
    });
    expect(again.reused).toBe(true);
    expect(again.version.id).toBe(first.version.id);
  });

  it("THE POINT: a later import does not erase the earlier one", async () => {
    const edited = await repo.preserveSource(userId, {
      sourceKind: "resume",
      sourceKey: "track-1",
      content: "IT Support Specialist at Crozaint. Windows, Linux, Microsoft 365.",
    });
    expect(edited.version.version).toBe(2);

    const history = await repo.listSourceVersions(userId, "resume", "track-1");
    expect(history).toHaveLength(2);
    expect(history[0].content).not.toContain("Microsoft 365");
    expect(history[1].content).toContain("Microsoft 365");
  });

  it("separate streams keep separate numbering", async () => {
    const linkedin = await repo.preserveSource(userId, {
      sourceKind: "linkedin",
      sourceKey: "self",
      content: "Pasted LinkedIn history.",
    });
    expect(linkedin.version.version).toBe(1);
  });

  it("a correction appends a version instead of overwriting the fact", async () => {
    const first = await repo.recordFactVersion(userId, { factId, snapshot: snapshot() });
    expect(first.version.version).toBe(1);
    expect(first.unchanged).toBe(false);

    const corrected = await repo.recordFactVersion(userId, {
      factId,
      snapshot: snapshot({ organization: "Crozaint Technologies Pvt Ltd" }),
    });
    expect(corrected.version.version).toBe(2);

    const history = await repo.listFactVersions(userId, factId);
    expect(history.map((v) => v.snapshot.organization)).toEqual([
      "Crozaint Technologies",
      "Crozaint Technologies Pvt Ltd",
    ]);
    const current = await repo.currentFactVersion(userId, factId);
    expect(current?.version).toBe(2);
  });

  it("an unchanged save does not inflate a fact's history", async () => {
    const before = await repo.listFactVersions(userId, factId);
    const same = await repo.recordFactVersion(userId, {
      factId,
      snapshot: snapshot({ organization: "Crozaint Technologies Pvt Ltd" }),
    });
    expect(same.unchanged).toBe(true);
    expect(await repo.listFactVersions(userId, factId)).toHaveLength(before.length);
  });

  it("withdrawing a claim is a version, not a deletion", async () => {
    const retracted = await repo.recordFactVersion(userId, {
      factId,
      status: "retracted",
      snapshot: snapshot({ organization: "Crozaint Technologies Pvt Ltd" }),
    });
    expect(retracted.version.status).toBe("retracted");
    expect((await repo.listFactVersions(userId, factId)).length).toBeGreaterThanOrEqual(3);
  });

  // Codex read stage 1 and pointed out that reading max() and inserting is not serialized by a
  // transaction alone, and that a two-call race test can pass on timing. These contend properly:
  // eight writers on ONE stream, started together. Without the advisory lock they read the same
  // maximum and the unique index rejects the losers - the run fails outright rather than
  // numbering them.
  it("eight concurrent imports each get their own version, and none is rejected", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        repo.preserveSource(userId, {
          sourceKind: "resume",
          sourceKey: "race",
          content: `resume revision ${i}`,
        })
      )
    );
    const versions = results.map((r) => r.version.version);
    expect(new Set(versions).size).toBe(8);
    expect([...versions].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    const kept = await repo.listSourceVersions(userId, "resume", "race");
    expect(kept.map((v) => v.content).sort()).toEqual(
      Array.from({ length: 8 }, (_, i) => `resume revision ${i}`).sort()
    );
  });

  it("eight concurrent corrections to one fact append in order, losing none", async () => {
    const raced = "33333333-3333-4333-8333-333333333333";
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        repo.recordFactVersion(userId, { factId: raced, snapshot: snapshot({ period: `202${i}` }) })
      )
    );
    expect(new Set(results.map((r) => r.version.version)).size).toBe(8);

    const history = await repo.listFactVersions(userId, raced);
    expect(history.map((v) => v.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const current = await repo.currentFactVersion(userId, raced);
    expect(current?.version).toBe(8);
  });
});
