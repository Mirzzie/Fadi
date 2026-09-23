import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Today had no test of its own, which is how "one goal, one next action" could be claimed
 * while the next action was read from every goal the person had ever set.
 */
const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/database/client", () => ({ getDatabase: () => holder.db }));
// Today asks the guidance layer for a fallback step; it reads the same database and is not
// what these tests are about.
vi.mock("@/lib/guidance/setup", () => ({
  getSetupState: async () => ({
    steps: [],
    completed: 0,
    total: 0,
    percent: 0,
    nextStep: { id: "x", title: "Setup step", description: "", href: "/dashboard", cta: "Go", done: false },
    allDone: false,
    exploreNiche: { suggested: false, href: "/dashboard/niche-finder" },
  }),
}));

suite("Today", () => {
  let pool: import("pg").Pool;
  let work: import("@careeros/database").WorkItemsRepository;
  let getToday: typeof import("./today").getToday;
  let userId: string;

  beforeAll(async () => {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { createWorkItemsRepository } = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    userId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `today-${Date.now()}@example.test`,
      ])
    ).rows[0].id;
    holder.db = drizzle(pool) as never;
    work = createWorkItemsRepository(holder.db as never);
    ({ getToday } = await import("./today"));
  });

  afterAll(async () => {
    if (userId) await pool.query("delete from users where id = $1", [userId]);
    await pool?.end();
  });

  it("follows the goal you switch to", async () => {
    const first = await work.create(userId, { kind: "goal", title: "Get a support role" });
    await work.create(userId, {
      kind: "step",
      title: "Tailor the CV",
      parentId: first.id,
    });
    const second = await work.create(userId, { kind: "goal", title: "Get a security role" });
    await work.create(userId, {
      kind: "step",
      title: "Finish the SIEM lab",
      parentId: second.id,
    });

    await work.setActiveGoal(userId, first.id);
    const onFirst = await getToday(userId, "Mirzad", "apply");
    expect(onFirst.goal.title).toBe("Get a support role");
    expect(onFirst.action?.title).toBe("Tailor the CV");

    await work.setActiveGoal(userId, second.id);
    const onSecond = await getToday(userId, "Mirzad", "apply");
    expect(onSecond.goal.title).toBe("Get a security role");
    // The defect: the next action stayed on the goal the person had just left.
    expect(onSecond.action?.title).toBe("Finish the SIEM lab");
    expect(onSecond.alsoOpen.map((step) => step.title)).not.toContain("Tailor the CV");
    expect(onSecond.otherGoals.map((goal) => goal.title)).toEqual(["Get a support role"]);

    await work.remove(userId, first.id);
    await work.remove(userId, second.id);
  });

  it("falls back to the computed step when a goal has no work under it", async () => {
    const goal = await work.create(userId, { kind: "goal", title: "Nothing planned" });
    await work.setActiveGoal(userId, goal.id);

    const today = await getToday(userId, "Mirzad", "apply");
    expect(today.goal.source).toBe("goal");
    expect(today.action?.title).toBe("Setup step");
    // Not a step of the person's: it has no id, which is what hides the Done control.
    expect(today.action?.id).toBeNull();

    await work.remove(userId, goal.id);
  });

  it("says a direction is a direction when no goal is set", async () => {
    const today = await getToday(userId, "Mirzad", "apply");
    expect(today.goal.source).toBe("none");
    expect(today.action?.title).toBe("Setup step");
  });
});
