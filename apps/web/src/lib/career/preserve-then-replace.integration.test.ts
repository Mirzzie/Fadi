import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * IF THE HISTORY CANNOT BE WRITTEN, THE OVERWRITE DOES NOT HAPPEN — against a real database.
 *
 * Codex's S2-R1: preservation used to be best-effort, so a failed version write was followed by
 * the destructive save anyway, and the previous CV text was gone with nothing kept. The proof has
 * to inject a REAL failure, so this installs a trigger that makes inserting a source version
 * fail for this one user, then checks what survived.
 *
 * Requires FADI_TEST_DATABASE_URL, and DATABASE_URL pointing at the same database.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL && process.env.DATABASE_URL === URL ? describe : describe.skip;

suite("preserve then replace", () => {
  let pool: import("pg").Pool;
  let userId: string;

  const storedResume = async () =>
    (await pool.query(`select raw_text from resumes where user_id = $1`, [userId])).rows[0]
      ?.raw_text ?? null;

  beforeAll(async () => {
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: URL });
    const email = `preserve-${Date.now()}@example.test`;
    userId = (await pool.query(`insert into users (email) values ($1) returning id`, [email])).rows[0].id;
    await pool.query(
      `create or replace function fadi_test_block_source() returns trigger as $$
         begin raise exception 'injected source-version failure'; end;
       $$ language plpgsql`
    );
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`drop trigger if exists fadi_test_block on career_source_versions`);
    await pool.query(`drop function if exists fadi_test_block_source()`);
    if (userId) await pool.query(`delete from users where id = $1`, [userId]);
    await pool.end();
  });

  const save = async (text: string) => {
    const { preserveThenReplace } = await import("./sources");
    const { createResumesRepository } = await import("@careeros/database");
    return preserveThenReplace(
      userId,
      { sourceKind: "resume", sourceKey: "no-direction", content: text },
      (tx) => createResumesRepository(tx).upsertLatestForTrack(userId, null, text)
    );
  };

  it("keeps the text and its version together on a normal save", async () => {
    await save("First CV. IT Support Specialist at Crozaint.");
    expect(await storedResume()).toContain("First CV");
    const versions = await pool.query(
      `select content from career_source_versions where user_id = $1 order by version`,
      [userId]
    );
    expect(versions.rows).toHaveLength(1);
  });

  it("THE POINT: a failed history write leaves the previous CV exactly where it was", async () => {
    await pool.query(
      `create trigger fadi_test_block before insert on career_source_versions
       for each row when (new.user_id = '${userId}') execute function fadi_test_block_source()`
    );
    try {
      // The driver wraps the database's own message, so what matters is that it threw at all:
      // the caller is told, instead of being handed a quiet success over a lost CV.
      await expect(save("Second CV, which must not land.")).rejects.toThrow();

      // The overwrite was inside the same transaction, so it rolled back with the failure.
      expect(await storedResume()).toContain("First CV");
      const versions = await pool.query(
        `select content from career_source_versions where user_id = $1`,
        [userId]
      );
      expect(versions.rows).toHaveLength(1);
    } finally {
      await pool.query(`drop trigger fadi_test_block on career_source_versions`);
    }
  });

  it("and saving again once the failure is gone keeps both versions", async () => {
    await save("Second CV, now with the new job.");
    expect(await storedResume()).toContain("now with the new job");
    const versions = await pool.query(
      `select version, content from career_source_versions where user_id = $1 order by version`,
      [userId]
    );
    expect(versions.rows.map((r) => r.version)).toEqual([1, 2]);
  });

  it("a failing replacement does not leave a version claiming it happened", async () => {
    const { preserveThenReplace } = await import("./sources");
    await expect(
      preserveThenReplace(
        userId,
        { sourceKind: "resume", sourceKey: "no-direction", content: "Third CV." },
        async () => {
          throw new Error("save failed");
        }
      )
    ).rejects.toThrow(/save failed/);

    const versions = await pool.query(
      `select content from career_source_versions where user_id = $1`,
      [userId]
    );
    expect(versions.rows.map((r) => r.content)).not.toContain("Third CV.");
  });
});
