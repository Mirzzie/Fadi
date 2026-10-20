import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The two rules that decide whether a posting is still real, against a real database.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("retiring dead postings", () => {
  let pool: import("pg").Pool;
  let repo: ReturnType<typeof import("@careeros/database").createJobsRepository>;
  const made: string[] = [];

  beforeAll(async () => {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { createJobsRepository } = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    repo = createJobsRepository(drizzle(pool) as never);
  });

  afterAll(async () => {
    if (made.length > 0) {
      await pool.query("delete from jobs where id = any($1)", [made]);
    }
    await pool?.end();
  });

  async function posting(source: string, lastSeen: Date) {
    const job = await repo.upsertSeedJob({
      source,
      externalId: `upkeep-${source}-${Date.now()}-${Math.random()}`,
      title: "Service Desk Engineer",
      company: "Upkeep Test",
      location: "Dublin",
      description: "A role.",
      url: `https://example.test/${Math.random()}`,
    });
    made.push(job.id);
    await pool.query("update job_occurrences set last_seen_at = $2 where job_id = $1", [
      job.id,
      lastSeen,
    ]);
    return job.id;
  }

  const days = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  const statusOf = async (id: string) =>
    (await pool.query("select status from jobs where id = $1", [id])).rows[0]?.status;

  it("retires postings whose source Fadi no longer has, and keeps the rest", async () => {
    const gone = await posting("arbeitnow", new Date());
    const kept = await posting("reed", new Date());
    const subBoard = await posting("fadi-scraper:indeed", new Date());

    const retired = await repo.expireJobsFromRetiredSources([
      "reed",
      "jooble",
      "web-surfer",
      "web-crawl",
      "fadi-scraper",
    ]);

    expect(retired).toBeGreaterThanOrEqual(1);
    expect(await statusOf(gone)).toBe("expired");
    expect(await statusOf(kept)).toBe("active");
    // A source stamps its sub-board on the posting; that is still the same live source.
    expect(await statusOf(subBoard)).toBe("active");
  });

  /**
   * The defect this exists for: staleness was keyed on `jobs.updated_at`, which a liveness
   * probe or an embedding write bumps. Every posting looked fresh forever and nothing was ever
   * aged out — 2,595 "active" vacancies, none of them older than fourteen days by that measure.
   */
  it("ages out by when a source last listed it, not by when we last wrote the row", async () => {
    const forgotten = await posting("reed", days(30));
    const current = await posting("reed", days(1));

    // Touch the stale one the way maintenance does. It must not count as freshness.
    await repo.setJobLiveness(forgotten, "unknown");

    const archived = await repo.archiveStaleLiveJobs(days(14));
    expect(archived).toBeGreaterThanOrEqual(1);
    expect(await statusOf(forgotten)).toBe("expired");
    expect(await statusOf(current)).toBe("active");
  });

  it("offers the never-checked postings for probing first", async () => {
    const checked = await posting("reed", new Date());
    const never = await posting("reed", new Date());
    await repo.setJobLiveness(checked, "live");

    const queue = await repo.listForLivenessSweep(500);
    const ids = queue.map((row) => row.id);
    expect(ids).toContain(never);

    // The invariant, not the positions of two rows: nothing already checked may come before
    // something never checked. Asserting on indexes broke as soon as the table had more rows
    // than the page — the second id simply was not in it, and -1 compares as "earlier".
    const firstChecked = queue.findIndex((row) => row.livenessCheckedAt !== null);
    const lastNever = queue.reduce(
      (last, row, index) => (row.livenessCheckedAt === null ? index : last),
      -1
    );
    if (firstChecked !== -1 && lastNever !== -1) expect(lastNever).toBeLessThan(firstChecked);
    if (ids.includes(checked)) expect(ids.indexOf(never)).toBeLessThan(ids.indexOf(checked));
  });
});
