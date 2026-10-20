import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("Conversations scoped to a piece of work", () => {
  let pool: import("pg").Pool;
  let messages: ReturnType<typeof import("@careeros/database").createAgentMessagesRepository>;
  let work: import("@careeros/database").WorkItemsRepository;
  let userId: string;
  let goalId: string;
  let otherId: string;

  beforeAll(async () => {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { createAgentMessagesRepository, createWorkItemsRepository } = await import(
      "@careeros/database"
    );
    pool = new Pool({ connectionString: URL });
    userId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `threads-${Date.now()}@example.test`,
      ])
    ).rows[0].id;
    const db = drizzle(pool) as never;
    messages = createAgentMessagesRepository(db);
    work = createWorkItemsRepository(db);
    goalId = (await work.create(userId, { kind: "goal", title: "Apply to Stripe" })).id;
    otherId = (await work.create(userId, { kind: "goal", title: "Apply to Intercom" })).id;
  });

  afterAll(async () => {
    if (userId) await pool.query("delete from users where id = $1", [userId]);
    await pool?.end();
  });

  it("keeps each piece of work's conversation to itself", async () => {
    await messages.createForUser(userId, {
      role: "user",
      content: "Is the Stripe letter ready?",
      workItemId: goalId,
    });
    await messages.createForUser(userId, {
      role: "user",
      content: "And the Intercom one?",
      workItemId: otherId,
    });
    await messages.createForUser(userId, { role: "user", content: "How am I doing overall?" });

    const stripe = await messages.listRecentForUser(userId, 50, { workItemId: goalId });
    expect(stripe.map((row) => row.content)).toEqual(["Is the Stripe letter ready?"]);

    // No scope at all is the general conversation — not everything ever said.
    const general = await messages.listRecentForUser(userId, 50, { workItemId: null });
    expect(general.map((row) => row.content)).toEqual(["How am I doing overall?"]);

    // And the unscoped read still sees the lot, for the activity feed.
    expect(await messages.listRecentForUser(userId, 50)).toHaveLength(3);
  });

  it("returns the conversation to general history when the work is deleted", async () => {
    const step = await work.create(userId, {
      kind: "step",
      title: "Send it",
      parentId: goalId,
    });
    await messages.createForUser(userId, {
      role: "assistant",
      content: "Sent, and I logged the follow-up.",
      workItemId: step.id,
    });

    await work.remove(userId, step.id);

    // Surviving in the table is not enough — it has to be REACHABLE. Keeping the dead id left
    // the turn out of general history and openable by no screen at all.
    const general = await messages.listRecentForUser(userId, 50, { workItemId: null });
    const kept = general.find((row) => row.content === "Sent, and I logged the follow-up.");
    expect(kept).toBeDefined();
    expect(kept!.workItemId).toBeNull();
    // And it still says what it was about, so the turn can be explained after the fact.
    expect((kept!.metadata as { formerWork?: string }).formerWork).toBe("Send it");

    const stillThreaded = await messages.listRecentForUser(userId, 50, { workItemId: step.id });
    expect(stillThreaded).toHaveLength(0);
  });
});
