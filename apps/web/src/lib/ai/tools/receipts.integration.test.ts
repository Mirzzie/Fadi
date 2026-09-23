import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getFadiTools } from "./registry";
import { runWithReceipt } from "./receipts";
import type { FadiTool } from "./types";

// Hoisted: `./registry` imports `./receipts` at load time, so a mock installed inside
// beforeAll would arrive after the real client was already bound.
const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/database/client", () => ({ getDatabase: () => holder.db }));

describe("the capability contract", () => {
  it("makes every tool say what it touches", () => {
    for (const tool of getFadiTools()) {
      expect(["read", "write", "external"]).toContain(tool.risk);
    }
  });

  it("makes anything consequential say what it did, for the receipt", () => {
    for (const tool of getFadiTools()) {
      if (tool.risk === "read") continue;
      expect(tool.effect, `${tool.name} has no effect line`).toBeTruthy();
    }
  });
});

const URL = process.env.FADI_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite("receipts for what Fadi did", () => {
  let pool: import("pg").Pool;
  let userId: string;
  let work: import("@careeros/database").WorkItemsRepository;

  beforeAll(async () => {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { createWorkItemsRepository } = await import("@careeros/database");
    pool = new Pool({ connectionString: URL });
    userId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `receipts-${Date.now()}@example.test`,
      ])
    ).rows[0].id;
    const db = drizzle(pool) as never;
    holder.db = db;
    work = createWorkItemsRepository(db);
  });

  afterAll(async () => {
    if (userId) await pool.query("delete from users where id = $1", [userId]);
    await pool?.end();
  });

  function tool(over: Partial<FadiTool>): FadiTool {
    return {
      name: "test_tool",
      description: "",
      risk: "write",
      effect: "Did the thing.",
      parameters: {},
      execute: async () => ({ summary: "It worked." }),
      ...over,
    } as FadiTool;
  }

  it("leaves nothing behind for a question", async () => {
    await runWithReceipt(tool({ risk: "read", effect: undefined }), {}, { userId });
    expect(await work.listExecutions(userId, { limit: 10 })).toHaveLength(0);
  });

  it("records what a write did, in the tool's own words", async () => {
    const result = await runWithReceipt(tool({}), {}, { userId, surface: "chat" });
    expect(result.summary).toBe("It worked.");

    const [receipt] = await work.listExecutions(userId, { limit: 1 });
    expect(receipt.action).toBe("Did the thing.");
    expect(receipt.risk).toBe("write");
    expect(receipt.status).toBe("done");
    expect(receipt.receipt).toBe("It worked.");
    expect(receipt.finishedAt).toBeInstanceOf(Date);
  });

  it("calls a tool that reports its own failure a failure", async () => {
    await runWithReceipt(
      tool({ execute: async () => ({ summary: "Could not reach it.", isError: true }) }),
      {},
      { userId }
    );
    const [receipt] = await work.listExecutions(userId, { limit: 1 });
    expect(receipt.status).toBe("failed");
    expect(receipt.error).toBe("Could not reach it.");
  });

  it("records a crash instead of swallowing it", async () => {
    await expect(
      runWithReceipt(
        tool({
          risk: "external",
          execute: async () => {
            throw new Error("the host refused");
          },
        }),
        {},
        { userId }
      )
    ).rejects.toThrow("the host refused");

    const [receipt] = await work.listExecutions(userId, { limit: 1 });
    expect(receipt.status).toBe("failed");
    expect(receipt.risk).toBe("external");
    expect(receipt.error).toContain("the host refused");
  });

  it("lands the receipt on the work it was done for", async () => {
    const goal = await work.create(userId, { kind: "goal", title: "Receipted work" });
    await runWithReceipt(tool({}), {}, { userId, workItemId: goal.id });

    const onWork = await work.listExecutions(userId, { workItemId: goal.id });
    expect(onWork).toHaveLength(1);
    await work.remove(userId, goal.id);
  });
});
