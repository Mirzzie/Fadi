import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// The action is the thing under test, so only the session is faked — every write goes to the
// real database through the real repositories.
const auth = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentAuthUser: async () => ({
    id: auth.userId,
    email: "save@example.test",
    externalAuthProvider: "better_auth" as const,
    externalAuthUserId: "test",
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/observability/logger", () => ({
  logger: { info: () => undefined, warn: () => undefined, error: (...a: unknown[]) => console.log("ERR", JSON.stringify(a)) },
}));

/**
 * SAVING THE PROFILE MUST NOT ERASE WHAT THE PROFILE NO LONGER EDITS — against a real database.
 *
 * Codex C15-01. When CV and LinkedIn intake moved to Evidence, Profile stopped sending that text
 * but kept sending the LinkedIn URL. The save read the absent text as "" and wrote null over the
 * stored history — the exact loss S2-R1 was built to prevent, on an ordinary Save.
 *
 * The source gate could not see it: it checks that a file calls a preservation helper, not what
 * happens when a field is omitted.
 *
 * Requires FADI_TEST_DATABASE_URL, and DATABASE_URL pointing at the same database.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL && process.env.DATABASE_URL === URL ? describe : describe.skip;

suite("saving the profile", () => {
  let pool: import("pg").Pool;
  let userId: string;

  const stored = async () =>
    (
      await pool.query(
        `select profile_url, raw_text from linkedin_profiles where user_id = $1 order by created_at desc limit 1`,
        [userId]
      )
    ).rows[0] ?? null;

  beforeAll(async () => {
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: URL });
    const email = `profile-save-${Date.now()}@example.test`;
    userId = (await pool.query(`insert into users (email) values ($1) returning id`, [email])).rows[0].id;
    auth.userId = userId;
    await pool.query(`insert into profiles (user_id, full_name, email) values ($1,'Save Test',$2)`, [
      userId,
      email,
    ]);
  }, 60_000);

  beforeEach(async () => {
    await pool.query(`delete from linkedin_profiles where user_id = $1`, [userId]);
    await pool.query(`delete from career_source_versions where user_id = $1`, [userId]);
  });

  afterAll(async () => {
    if (userId) await pool.query(`delete from users where id = $1`, [userId]);
    await pool?.end();
  });

  const seedHistory = async () => {
    const { createLinkedInProfilesRepository } = await import("@careeros/database");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    await createLinkedInProfilesRepository(drizzle(pool) as never).upsertLatestForUser(userId, {
      profileUrl: "https://www.linkedin.com/in/old/",
      rawText: "Fifteen years of support engineering, written by hand.",
    });
  };

  it("THE DEFECT: saving with the URL alone keeps the stored history", async () => {
    await seedHistory();
    const { updateProfileAction } = await import("@/app/dashboard/profile/actions");

    // Exactly what the Profile form sends today — no linkedInText field at all.
    await updateProfileAction({
      fullName: "Save Test",
      targetRole: "IT Support",
      location: "Dublin",
      experienceLevel: "",
      careerGoal: "",
      linkedInUrl: "https://www.linkedin.com/in/new-handle/",
    });

    const row = await stored();
    expect(row?.raw_text).toBe("Fifteen years of support engineering, written by hand.");
    expect(row?.profile_url).toBe("https://www.linkedin.com/in/new-handle/");
  });

  it("still replaces the text when the person actually edits it", async () => {
    await seedHistory();
    const { updateProfileAction } = await import("@/app/dashboard/profile/actions");

    await updateProfileAction({
      fullName: "Save Test",
      targetRole: "IT Support",
      location: "Dublin",
      experienceLevel: "",
      careerGoal: "",
      linkedInUrl: "https://www.linkedin.com/in/new-handle/",
      linkedInText: "A new paste of my LinkedIn about section.",
    });

    expect((await stored())?.raw_text).toBe("A new paste of my LinkedIn about section.");
    const versions = await pool.query(
      `select content from career_source_versions where user_id = $1 and source_kind = 'linkedin'`,
      [userId]
    );
    expect(versions.rows.map((r) => r.content)).toContain("A new paste of my LinkedIn about section.");
  });
});
