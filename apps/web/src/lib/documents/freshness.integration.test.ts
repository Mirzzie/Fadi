import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * A DOCUMENT NOTICES WHEN THE PERSON'S RECORD MOVES — against a real database.
 *
 * The comparison spans generation's captured snapshot, the evidence pool and the selection rules,
 * so a mocked version of it would prove only that the mock agrees with itself.
 *
 * Requires FADI_TEST_DATABASE_URL, and DATABASE_URL pointing at the same database (the context
 * builder uses the application's own client).
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL && process.env.DATABASE_URL === URL ? describe : describe.skip;

suite("a document knows when it has fallen behind", () => {
  let pool: import("pg").Pool;
  let userId: string;
  let directionId: string;

  const addEvidence = async (title: string, detail: string) => {
    const { rows } = await pool.query(
      `insert into evidence_items (user_id, kind, title, organization, period, detail, origin, is_canonical, review_status, attribution)
       values ($1,'project',$2,null,'2026',$3,'manual',true,'accepted','personal') returning id`,
      [userId, title, detail]
    );
    await pool.query(`update evidence_items set fact_id = id where id = $1`, [rows[0].id]);
    return rows[0].id as string;
  };

  beforeAll(async () => {
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: URL });
    const email = `freshness-${Date.now()}@example.test`;
    userId = (await pool.query(`insert into users (email) values ($1) returning id`, [email]))
      .rows[0].id;
    await pool.query(
      `insert into profiles (user_id, full_name, email) values ($1,'Freshness Check',$2)`,
      [userId, email]
    );
    directionId = (
      await pool.query(
        `insert into career_profiles (user_id, target_role, career_goal, imported_from, analysis_status, intent, is_active)
         values ($1,'IT Support Specialist','Get hired in Dublin','manual','complete','switch',true) returning id`,
        [userId]
      )
    ).rows[0].id;
    await addEvidence("Service desk rebuild", "Rebuilt the imaging process for 400 machines.");
  }, 60_000);

  afterAll(async () => {
    if (userId) await pool.query(`delete from users where id = $1`, [userId]);
    await pool?.end();
  });

  it("says nothing while the document still matches the record it was written from", async () => {
    const { buildCareerContext } = await import("@/lib/career/context");
    const { documentFreshness } = await import("./freshness.server");
    const context = await buildCareerContext(userId, { directionId }, { persist: true });

    const fresh = await documentFreshness(userId, {
      metadata: {
        careerContextSnapshotId: context.snapshotId,
        careerContextFingerprint: context.fingerprint,
        contextSchemaVersion: 1,
      },
      careerProfileId: directionId,
      applicationId: null,
      jobId: null,
    });

    expect(fresh.state).toBe("current");
  });

  it("names the work added since, so the person knows what is missing", async () => {
    const { buildCareerContext } = await import("@/lib/career/context");
    const { documentFreshness } = await import("./freshness.server");
    const context = await buildCareerContext(userId, { directionId }, { persist: true });

    await addEvidence("SOC home lab", "Built a detection lab with Wazuh and Sysmon.");

    const fresh = await documentFreshness(userId, {
      metadata: {
        careerContextSnapshotId: context.snapshotId,
        careerContextFingerprint: context.fingerprint,
        contextSchemaVersion: 1,
      },
      careerProfileId: directionId,
      applicationId: null,
      jobId: null,
    });

    expect(fresh.state).toBe("stale");
    if (fresh.state !== "stale") return;
    expect(fresh.changes.added).toContain("SOC home lab");
    expect(fresh.note).toContain("SOC home lab");
    expect(fresh.ask).toBe("Work in SOC home lab");
  });

  it("sees a correction as a rewording of the same work", async () => {
    const { buildCareerContext } = await import("@/lib/career/context");
    const { documentFreshness } = await import("./freshness.server");
    const factId = await addEvidence("Ticket triage", "Handled first-line tickets.");
    const context = await buildCareerContext(userId, { directionId }, { persist: true });

    await pool.query(`update evidence_items set detail = $2 where id = $1`, [
      factId,
      "Handled first-line tickets for 400 staff across two sites.",
    ]);

    const fresh = await documentFreshness(userId, {
      metadata: {
        careerContextSnapshotId: context.snapshotId,
        careerContextFingerprint: context.fingerprint,
        contextSchemaVersion: 1,
      },
      careerProfileId: directionId,
      applicationId: null,
      jobId: null,
    });

    expect(fresh.state).toBe("stale");
    if (fresh.state !== "stale") return;
    expect(fresh.changes.reworded).toContain("Ticket triage");
    expect(fresh.changes.added).not.toContain("Ticket triage");
  });

  it("flags an employer/date correction even when the description stays identical", async () => {
    const { buildCareerContext } = await import("@/lib/career/context");
    const { documentFreshness } = await import("./freshness.server");
    const factId = await addEvidence("Employment correction", "Resolved support incidents.");
    const context = await buildCareerContext(userId, { directionId }, { persist: true });
    await pool.query(
      "update evidence_items set organization = 'Correct employer', period = '2025' where id = $1",
      [factId]
    );
    const fresh = await documentFreshness(userId, {
      metadata: {
        careerContextSnapshotId: context.snapshotId,
        careerContextFingerprint: context.fingerprint,
        contextSchemaVersion: 1,
      },
      careerProfileId: directionId,
      applicationId: null,
      jobId: null,
    });
    expect(fresh.state).toBe("stale");
    if (fresh.state === "stale")
      expect(fresh.changes.reworded).toContain("Employment correction (Correct employer)");
  });

  it("claims nothing about a document Fadi never generated", async () => {
    const { documentFreshness } = await import("./freshness.server");
    expect(
      await documentFreshness(userId, {
        metadata: {},
        careerProfileId: directionId,
        applicationId: null,
        jobId: null,
      })
    ).toEqual({ state: "unknown" });
  });
});
