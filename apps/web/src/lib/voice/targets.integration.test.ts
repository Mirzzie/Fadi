import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Reaching a real record by a spoken name. The failure that matters is opening the WRONG one
 * for someone who cannot see where they landed.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/database/client", () => ({ getDatabase: () => holder.db }));

suite("finding what somebody named", () => {
  let pool: import("pg").Pool;
  let resolveVoiceTarget: typeof import("./targets").resolveVoiceTarget;
  let userId: string;
  let deerfoot: string;
  const stamp = Date.now();

  beforeAll(async () => {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { createDocumentsRepository, createJobsRepository } = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    userId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `targets-${Date.now()}@example.test`,
      ])
    ).rows[0].id;
    holder.db = drizzle(pool) as never;

    const jobs = createJobsRepository(holder.db as never);
    deerfoot = (
      await jobs.upsertSeedJob({
        source: "reed",
        externalId: `t-deerfoot-${stamp}`,
        title: "Contract IS Technical Support Analyst",
        company: "Deerfoot Recruitment",
        location: "Dublin",
        description: "Support role.",
        url: "https://example.test/1",
      })
    ).id;
    await jobs.upsertSeedJob({
      source: "reed",
      externalId: `t-intercom-${stamp}`,
      // A word only this row has: the shared catalogue holds real AppSec roles too.
      title: `Application Security Engineer ${stamp}`,
      company: "Intercom",
      location: "Dublin",
      description: "Security role.",
      url: "https://example.test/2",
    });
    await createDocumentsRepository(holder.db as never).createForUser(userId, {
      kind: "cover_letter",
      title: "Cover letter — Stripe",
      content: "Dear Stripe,",
    });

    ({ resolveVoiceTarget } = await import("./targets"));
  });

  afterAll(async () => {
    if (userId) await pool.query("delete from users where id = $1", [userId]);
    // Seeded into the PUBLIC catalogue: left behind, they showed up as real roles for everyone
    // and made each later run's names ambiguous.
    await pool?.query(
      "delete from jobs where external_id like 't-deerfoot-%' or external_id like 't-intercom-%'"
    );
    await pool?.end();
  });

  it("opens the job someone named, by company or by title", async () => {
    const byCompany = await resolveVoiceTarget(userId, "the deerfoot job");
    expect(byCompany?.kind).toBe("job");
    expect(byCompany?.id).toBe(deerfoot);
    expect(byCompany?.href).toBe(`/dashboard/applications/${deerfoot}/workspace`);

    const byTitle = await resolveVoiceTarget(
      userId,
      `the application security engineer ${stamp} role`
    );
    expect(byTitle?.label).toContain("Intercom");
  });

  it("finds a document as readily as a job", async () => {
    const letter = await resolveVoiceTarget(userId, "my stripe cover letter");
    expect(letter?.kind).toBe("document");
    expect(letter?.href).toMatch(/^\/dashboard\/documents\//);
  });

  /** The whole safety case: nothing plausible, nothing ambiguous, nothing invented. */
  it("returns nothing rather than the closest thing", async () => {
    expect(await resolveVoiceTarget(userId, "the Google role")).toBeNull();
    expect(await resolveVoiceTarget(userId, "that thing from yesterday")).toBeNull();
    // Words that only match the noise words carry no signal at all.
    expect(await resolveVoiceTarget(userId, "the job")).toBeNull();
  });

  it("can be held to one kind, so 'save that role' cannot save a document", async () => {
    expect(await resolveVoiceTarget(userId, "my stripe cover letter", "job")).toBeNull();
    expect((await resolveVoiceTarget(userId, "deerfoot", "job"))?.id).toBe(deerfoot);
  });
});
