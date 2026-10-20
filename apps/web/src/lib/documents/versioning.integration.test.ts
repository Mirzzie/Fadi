import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Requires a disposable database with the complete migration journal applied. */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("document versioning", () => {
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

  it("D11: rejects a stale tab and retains both accepted versions", async () => {
    const { createDocumentsRepository } = await import("@careeros/database");
    const repo = createDocumentsRepository(orm as never);
    const userId = randomUUID();
    await pool.query(
      `insert into users (id, email, created_at, updated_at) values ($1, $2, now(), now())`,
      [userId, `d11-${userId}@example.test`]
    );

    try {
      const created = await repo.createForUser(userId, {
        kind: "note",
        title: "Concurrent draft",
        content: "Version one",
      });
      const tabA = await repo.getForUser(userId, created.id);
      const tabB = await repo.getForUser(userId, created.id);
      expect(tabA?.version).toBe(1);
      expect(tabB?.version).toBe(1);

      const accepted = await repo.updateForUser(userId, created.id, tabA!.version, {
        content: "Saved by tab A",
      });
      const rejected = await repo.updateForUser(userId, created.id, tabB!.version, {
        content: "Stale overwrite from tab B",
      });

      expect(accepted.status).toBe("updated");
      expect(accepted.status === "updated" && accepted.document.version).toBe(2);
      expect(rejected.status).toBe("conflict");
      expect(rejected.status === "conflict" && rejected.document.content).toBe("Saved by tab A");

      const current = await repo.getForUser(userId, created.id);
      expect(current?.content).toBe("Saved by tab A");
      expect(current?.version).toBe(2);

      const firstRevision = await repo.getRevisionForUser(userId, created.id, 1);
      expect(firstRevision?.snapshot.content).toBe("Version one");
      const restored = await repo.updateForUser(userId, created.id, current!.version, {
        content: firstRevision!.snapshot.content,
      });
      expect(restored.status).toBe("updated");
      expect(restored.status === "updated" && restored.document.version).toBe(3);

      const revisions = await repo.listRevisionsForUser(userId, created.id);
      expect(revisions.map((revision) => [revision.version, revision.snapshot.content])).toEqual([
        [3, "Version one"],
        [2, "Saved by tab A"],
        [1, "Version one"],
      ]);
    } finally {
      await pool.query(`delete from users where id = $1`, [userId]);
    }
  }, 60_000);
});
