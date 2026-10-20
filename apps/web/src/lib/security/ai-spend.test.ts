import { describe, expect, it } from "vitest";

import { consumeAiSpendLimit } from "./ai-spend";

describe("AI spend boundary", () => {
  it("enforces an individual allowance independently of the global allowance", async () => {
    const operation = `user-${Date.now()}-${Math.random()}`;
    const input = {
      userId: "u1",
      operation,
      perUserLimit: 1,
      globalLimit: 20,
      windowMs: 60_000,
    };

    expect((await consumeAiSpendLimit(input)).allowed).toBe(true);
    expect(await consumeAiSpendLimit(input)).toMatchObject({ allowed: false, scope: "user" });
    expect((await consumeAiSpendLimit({ ...input, userId: "u2" })).allowed).toBe(true);
  });

  it("enforces the shared allowance across different users", async () => {
    const operation = `global-${Date.now()}-${Math.random()}`;
    const common = { operation, perUserLimit: 20, globalLimit: 2, windowMs: 60_000 };

    expect((await consumeAiSpendLimit({ ...common, userId: "u1" })).allowed).toBe(true);
    expect((await consumeAiSpendLimit({ ...common, userId: "u2" })).allowed).toBe(true);
    expect(await consumeAiSpendLimit({ ...common, userId: "u3" })).toMatchObject({
      allowed: false,
      scope: "global",
    });
  });
});
