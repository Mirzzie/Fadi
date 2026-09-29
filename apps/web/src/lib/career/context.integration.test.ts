import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { buildCareerContext, saveCareerSelection } from "./context";
import { generateCareerDocument, NoHistoryError, type DocGenerate } from "@/lib/documents/generate";
import { parseResume } from "@/lib/documents/resume";

const url = process.env.FADI_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("career selection → captured context → saved document in Postgres", () => {
  let pool: import("pg").Pool;
  let userId: string,
    otherId: string,
    directionId: string,
    otherDirection: string,
    appId: string,
    first: string,
    second: string;
  const generated = {
    summary: "Support professional",
    experiences: [],
    education: [],
    projects: [],
    skills: [],
  };
  const select = (
    factId: string,
    mode: "auto" | "include" | "exclude" | "inherit",
    keepWording = false
  ) => ({ factId, mode, keepWording, sortOrder: 0 });
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== url || !new URL(url!).pathname.includes("identity_test_"))
      throw new Error("Use an isolated identity_test_ database for BOTH URLs.");
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: url });
    userId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `selection-${randomUUID()}@example.test`,
      ])
    ).rows[0].id;
    otherId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `selection-other-${randomUUID()}@example.test`,
      ])
    ).rows[0].id;
    await pool.query(
      "insert into profiles (user_id, full_name, email) values ($1, 'Test Candidate', 'candidate@example.test')",
      [userId]
    );
    directionId = (
      await pool.query(
        "insert into career_profiles (user_id, target_role, career_goal, is_active) values ($1, 'IT Support', 'Support users', true) returning id",
        [userId]
      )
    ).rows[0].id;
    otherDirection = (
      await pool.query(
        "insert into career_profiles (user_id, target_role, career_goal, is_active) values ($1, 'DevOps', 'Automate systems', false) returning id",
        [userId]
      )
    ).rows[0].id;
    await pool.query(
      "insert into resumes (user_id, career_profile_id, raw_text) values ($1, $2, 'Unreviewed employer called RawCVOnlyCompany')",
      [userId, directionId]
    );
    await pool.query(
      "insert into linkedin_profiles (user_id, raw_text) values ($1, 'Unreviewed claim called RawLinkedInOnlyCompany')",
      [userId]
    );
    appId = (
      await pool.query(
        "insert into applications (user_id, career_profile_id, company, title, job_description) values ($1, $2, 'Hiring company', 'Support engineer', 'Linux support') returning id",
        [userId, directionId]
      )
    ).rows[0].id;
  });
  beforeEach(async () => {
    await pool.query("delete from career_selections where user_id = $1", [userId]);
    await pool.query("delete from evidence_items where user_id = $1", [userId]);
    await pool.query("update career_profiles set is_active = false where user_id = $1", [userId]);
    await pool.query("update career_profiles set is_active = true where id = $1", [directionId]);
    first = (
      await pool.query(
        "insert into evidence_items (user_id, kind, title, organization, period, detail, attribution) values ($1, 'experience', 'Support engineer', 'Real employer', '2024', 'Resolved Linux incidents.', 'employment') returning id",
        [userId]
      )
    ).rows[0].id;
    second = (
      await pool.query(
        "insert into evidence_items (user_id, kind, title, organization, period, detail) values ($1, 'certification', 'Linux certification', 'Awarding body', '2025', 'Completed Linux assessment.') returning id",
        [userId]
      )
    ).rows[0].id;
  });
  afterAll(async () => {
    if (!pool) return;
    await pool.query("delete from users where id = any($1::uuid[])", [
      [userId, otherId].filter(Boolean),
    ]);
    await pool.end();
    const global = globalThis as typeof globalThis & {
      careerosDatabase?: { pool: import("pg").Pool };
    };
    await global.careerosDatabase?.pool.end();
    delete global.careerosDatabase;
  });
  it("persists direction defaults, application overrides and reset-to-inherited", async () => {
    await saveCareerSelection(userId, { directionId }, select(first, "exclude"));
    expect(
      (await buildCareerContext(userId, { applicationId: appId })).payload.records.map(
        (r) => r.factId
      )
    ).toEqual([second]);
    await saveCareerSelection(userId, { applicationId: appId }, select(first, "include", true));
    let context = await buildCareerContext(userId, { applicationId: appId });
    expect(context.payload.records).toHaveLength(2);
    expect(context.payload.records.find((r) => r.factId === first)?.keepWording).toBe(true);
    expect((await buildCareerContext(userId, { directionId })).payload.records).toHaveLength(1);
    await saveCareerSelection(userId, { applicationId: appId }, select(first, "inherit"));
    context = await buildCareerContext(userId, { applicationId: appId });
    expect(context.payload.records.map((r) => r.factId)).toEqual([second]);
  });
  it("never follows an unrelated active direction for an existing application", async () => {
    await saveCareerSelection(userId, { directionId }, select(first, "exclude"));
    await pool.query("update career_profiles set is_active = false where id = $1", [directionId]);
    await pool.query("update career_profiles set is_active = true where id = $1", [otherDirection]);
    const context = await buildCareerContext(userId, { applicationId: appId });
    expect(context.payload.directionId).toBe(directionId);
    expect(context.payload.records.map((r) => r.factId)).toEqual([second]);
    expect(context.payload.target.title).toBe("Support engineer");
  });
  it("uses the saved application copy when its discovery job has changed", async () => {
    const key = `context-${randomUUID()}`;
    const jobId = (
      await pool.query(
        "insert into jobs (source, external_id, owner_user_id, canonical_key, title, company, description) values ('test', $1, $2, $1, 'Stale DevOps title', 'Old company', 'Kubernetes deployment') returning id",
        [key, userId]
      )
    ).rows[0].id;
    const applicationId = (
      await pool.query(
        "insert into applications (user_id, career_profile_id, job_id, company, title, job_description) values ($1, $2, $3, 'Saved company', 'Support engineer', 'Linux incident support') returning id",
        [userId, directionId, jobId]
      )
    ).rows[0].id;

    const context = await buildCareerContext(userId, { applicationId, jobId });
    expect(context.payload.target).toMatchObject({
      title: "Support engineer",
      company: "Saved company",
      description: "Linux incident support",
    });
    expect(context.payload.records[0].matched).toContain("support");
    expect(context.payload.records[0].matched).not.toContain("kubernetes");
  });
  it("uses the best matching selected project as the outreach lead", async () => {
    const projectId = (
      await pool.query(
        "insert into evidence_items (user_id, kind, title, detail, tags, market_tags) values ($1, 'project', 'Linux incident response lab', 'Investigated and resolved Linux service incidents.', '[\"linux\", \"incident response\"]'::jsonb, '[\"technical support\"]'::jsonb) returning id",
        [userId]
      )
    ).rows[0].id;
    let capturedSystem = "";
    let capturedPrompt = "";
    const generator: DocGenerate = {
      structured: vi.fn(),
      text: async (system, prompt) => {
        capturedSystem = system;
        capturedPrompt = prompt;
        return "Hello — I built a Linux incident response lab relevant to this role.";
      },
    };

    await generateCareerDocument(userId, { kind: "email", applicationId: appId }, generator);

    expect(capturedSystem).toContain("Open with a brief, specific connection");
    expect(capturedPrompt).toContain(
      `PROJECT TO LEAD WITH FOR THIS ROLE: [${projectId}] Linux incident response lab`
    );
    expect(capturedPrompt).not.toContain("https://");
  });
  it("rejects foreign scopes, foreign records and direction/application mismatches", async () => {
    await expect(buildCareerContext(otherId, { directionId })).rejects.toThrow(
      "Direction unavailable"
    );
    await expect(buildCareerContext(otherId, { applicationId: appId })).rejects.toThrow(
      "Application unavailable"
    );
    await expect(
      buildCareerContext(userId, { applicationId: appId, directionId: otherDirection })
    ).rejects.toThrow("another direction");
    await expect(saveCareerSelection(otherId, {}, select(first, "include"))).rejects.toThrow();
    await expect(
      saveCareerSelection(userId, { directionId }, select(randomUUID(), "include"))
    ).rejects.toThrow("accepted");
  });
  it("does not select pending or unclassified rows, and fails closed without selected history", async () => {
    await pool.query("update evidence_items set review_status = 'pending' where id = $1", [first]);
    await pool.query("update evidence_items set kind = 'unclassified' where id = $1", [second]);
    const generator = { text: vi.fn(), structured: vi.fn() } as unknown as DocGenerate;
    await expect(
      generateCareerDocument(userId, { kind: "resume" }, generator)
    ).rejects.toBeInstanceOf(NoHistoryError);
    expect(generator.structured).not.toHaveBeenCalled();
    await expect(
      saveCareerSelection(userId, { directionId }, select(first, "include"))
    ).rejects.toThrow("accepted");
  });
  it("captures once, preserves facts and certifications, and links the saved document to those exact inputs", async () => {
    await saveCareerSelection(userId, { applicationId: appId }, select(first, "include", true));
    let capturedPrompt = "";
    const generator: DocGenerate = {
      text: async () => "Unused",
      structured: async (_system, prompt, schema) => {
        capturedPrompt = prompt;
        await pool.query(
          "update evidence_items set organization = 'Later correction', detail = 'Later wording' where id = $1",
          [first]
        );
        await pool.query("update career_profiles set is_active = false where id = $1", [
          directionId,
        ]);
        await pool.query("update career_profiles set is_active = true where id = $1", [
          otherDirection,
        ]);
        return schema.parse({
          ...generated,
          experiences: [
            {
              title: "Director",
              company: "Invented company",
              period: "2026",
              location: "",
              bullets: ["Invented role"],
            },
          ],
        });
      },
    };
    const result = await generateCareerDocument(
      userId,
      { kind: "resume", applicationId: appId },
      generator
    );
    const doc = (await pool.query("select * from documents where id = $1", [result.id])).rows[0];
    const resume = parseResume(doc.content)!;
    expect(doc.career_profile_id).toBe(directionId);
    expect(resume.experiences).toHaveLength(1);
    expect(resume.experiences[0]).toMatchObject({
      company: "Real employer",
      bullets: "Resolved Linux incidents.",
    });
    expect(resume.certifications).toHaveLength(1);
    expect(capturedPrompt).toContain("Real employer");
    expect(capturedPrompt).not.toContain("Later correction");
    expect(capturedPrompt).not.toContain("RawCVOnlyCompany");
    expect(capturedPrompt).not.toContain("RawLinkedInOnlyCompany");
    const snapshot = (
      await pool.query("select * from career_context_snapshots where id = $1", [
        doc.metadata.careerContextSnapshotId,
      ])
    ).rows[0];
    expect(snapshot.user_id).toBe(userId);
    expect(snapshot.payload.records).toHaveLength(2);
    expect(snapshot.payload.records[0].organization).toBe("Real employer");
    expect(snapshot.fingerprint).toBe(doc.metadata.careerContextFingerprint);
    expect((await buildCareerContext(userId, { applicationId: appId })).fingerprint).not.toBe(
      snapshot.fingerprint
    );
    const revision = (
      await pool.query("select snapshot from document_revisions where document_id = $1", [doc.id])
    ).rows[0].snapshot;
    expect(revision.metadata.careerContextSnapshotId).toBe(snapshot.id);
  });
  it("is deterministic across reads and captures an unregistered target without making it career evidence", async () => {
    const a = await buildCareerContext(userId, { directionId });
    const b = await buildCareerContext(userId, { directionId });
    expect(a.fingerprint).toBe(b.fingerprint);
    const c = await buildCareerContext(
      userId,
      { directionId },
      {
        persist: true,
        target: { title: "Cloud role", company: "Target only", description: "A requested skill" },
      }
    );
    expect(c.payload.target.company).toBe("Target only");
    expect(c.block).not.toContain("Target only");
    expect(c.snapshotId).toBeTruthy();
  });
});
