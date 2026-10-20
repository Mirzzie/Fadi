import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The everyday changes, named out loud. What matters: the change lands on the record the person
 * named and nothing else, a name that matches nothing or two things is asked about, a repeat
 * does not change anything twice, and one person's id never reaches another person's record.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/database/client", () => ({ getDatabase: () => holder.db }));
// The event bus fans out to other features; what is under test here is the record itself.
vi.mock("@/lib/events/bus", () => ({ publish: vi.fn(async () => undefined) }));

suite("everyday changes by name", () => {
  let pool: import("pg").Pool;
  let tools: typeof import("./career-actions");
  let userId: string;
  let otherId: string;
  let jobId: string;
  let applicationId: string;
  const stamp = Date.now();
  // Words nobody else's data contains, so the shared public catalogue cannot tie with them.
  const company = `Quillfjord${stamp}`;
  const ctx = () => ({ userId, surface: "agent" as const });

  beforeAll(async () => {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const db = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    const user = async (tag: string) =>
      (
        await pool.query("insert into users (email) values ($1) returning id", [
          `${tag}-${stamp}@example.test`,
        ])
      ).rows[0].id as string;
    userId = await user("career-actions");
    otherId = await user("career-actions-other");
    holder.db = drizzle(pool) as never;

    jobId = (
      await db.createJobsRepository(holder.db as never).upsertSeedJob({
        source: "reed",
        externalId: `t-quill-${stamp}`,
        title: "Detection Engineer",
        company,
        location: "Dublin",
        description: "Detection role.",
        url: "https://example.test/quill",
      })
    ).id;
    const applications = db.createApplicationsRepository(holder.db as never);
    applicationId = (
      await applications.createForUser(userId, {
        company: `Brightwater${stamp}`,
        title: "SOC Analyst",
        status: "applied",
      })
    ).id;
    // Two applications nobody could tell apart by role alone.
    await applications.createForUser(userId, {
      company: "Acme",
      title: `Platform${stamp} Engineer`,
      status: "interested",
    });
    await applications.createForUser(userId, {
      company: "Globex",
      title: `Platform${stamp} Engineer`,
      status: "interested",
    });
    await db.createDocumentsRepository(holder.db as never).createForUser(userId, {
      kind: "cover_letter",
      title: `Cover letter — Brightwater${stamp}`,
      content: "<p>Dear hiring team,</p><p>I run detections &amp; triage alerts.</p>",
    });

    tools = await import("./career-actions");
  });

  afterAll(async () => {
    await pool?.query("delete from users where id = any($1)", [[userId, otherId].filter(Boolean)]);
    await pool?.query("delete from jobs where external_id = $1", [`t-quill-${stamp}`]);
    await pool?.end();
  });

  it("saves the role someone named, after reading back exactly which one", async () => {
    const prepared = await tools.saveJobTool.prepare!({ job: `the ${company} role` }, ctx());
    expect(prepared).toMatchObject({ ok: true, args: { jobId } });
    if (!prepared.ok) return;
    expect(prepared.readBack).toBe(`save Detection Engineer at ${company} to your saved roles`);

    const done = await tools.saveJobTool.execute(prepared.args, ctx());
    expect(done.outcome).toBe("performed");
    const saved = await pool.query("select 1 from saved_jobs where user_id = $1 and job_id = $2", [
      userId,
      jobId,
    ]);
    expect(saved.rowCount).toBe(1);

    const removed = await tools.unsaveJobTool.execute({ job: company }, ctx());
    expect(removed.outcome).toBe("performed");
    const after = await pool.query(
      "select status from saved_jobs where user_id = $1 and job_id = $2",
      [userId, jobId]
    );
    expect(after.rows.every((row) => row.status !== "saved")).toBe(true);
  });

  it("moves an application on, and a repeat changes nothing", async () => {
    const prepared = await tools.setApplicationStatusTool.prepare!(
      { application: `Brightwater${stamp}`, status: "got an interview" },
      ctx()
    );
    expect(prepared).toMatchObject({ ok: true, args: { applicationId, status: "interviewing" } });
    if (!prepared.ok) return;
    expect(prepared.readBack).toBe(`mark SOC Analyst at Brightwater${stamp} as interviewing`);

    expect((await tools.setApplicationStatusTool.execute(prepared.args, ctx())).outcome).toBe(
      "performed"
    );
    expect((await tools.setApplicationStatusTool.execute(prepared.args, ctx())).outcome).toBe(
      "refused"
    );
    const row = await pool.query("select status from applications where id = $1", [applicationId]);
    expect(row.rows[0].status).toBe("interviewing");
  });

  it("asks instead of guessing when a name matches nothing or two things", async () => {
    const ambiguous = await tools.setApplicationStatusTool.prepare!(
      { application: `Platform${stamp} Engineer`, status: "applied" },
      ctx()
    );
    expect(ambiguous.ok).toBe(false);
    const nothing = await tools.saveJobTool.prepare!({ job: `Nowhere${stamp} Ltd` }, ctx());
    expect(nothing.ok).toBe(false);
    const noStatus = await tools.setApplicationStatusTool.prepare!(
      { application: `Brightwater${stamp}`, status: "null" },
      ctx()
    );
    expect(noStatus.ok).toBe(false);
  });

  it("never reaches another person's application, even given its id", async () => {
    const result = await tools.setApplicationStatusTool.execute(
      { applicationId, status: "rejected" },
      { userId: otherId, surface: "agent" }
    );
    expect(result.outcome).toBe("needs_input");
    const row = await pool.query("select status from applications where id = $1", [applicationId]);
    expect(row.rows[0].status).toBe("interviewing");
    // And their name lookups only ever see their own.
    const theirs = await tools.setApplicationStatusTool.prepare!(
      { application: `Brightwater${stamp}`, status: "rejected" },
      { userId: otherId }
    );
    expect(theirs.ok).toBe(false);
  });

  it("reads a document's words, not its markup", async () => {
    const read = await tools.readDocumentTool.execute(
      { document: `brightwater${stamp} cover letter` },
      ctx()
    );
    expect(read.summary).toContain("Dear hiring team, I run detections & triage alerts.");
    expect(read.summary).not.toContain("<p>");
    const list = await tools.listDocumentsTool.execute({}, ctx());
    expect(list.summary).toContain("You have 1 document.");
  });

  it("adds an experience once, however many times it is said", async () => {
    const said = { kind: "certification", title: `CompTIA Security+ ${stamp}`, period: "null" };
    expect((await tools.addExperienceTool.execute(said, ctx())).outcome).toBe("performed");
    expect((await tools.addExperienceTool.execute(said, ctx())).outcome).toBe("refused");
    const rows = await pool.query(
      "select period from evidence_items where user_id = $1 and title = $2",
      [userId, said.title]
    );
    expect(rows.rowCount).toBe(1);
    // A model's "null" is not a period.
    expect(rows.rows[0].period).toBeNull();
  });

  it("says plainly when there are no flagships to take on", async () => {
    const listed = await tools.listFlagshipsTool.execute({}, ctx());
    expect(listed.summary).toMatch(/No flagship projects yet/);
    const take = await tools.takeOnFlagshipTool.prepare!({ flagship: "the detection one" }, ctx());
    expect(take.ok).toBe(false);
  });
});
