import { afterEach, describe, expect, it, vi } from "vitest";

import { __resetBusForTests, publish, subscribe, subscriberCount } from "./bus";

vi.mock("@/lib/observability/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

afterEach(() => __resetBusForTests());

describe("event bus", () => {
  it("delivers a published fact to its subscriber", async () => {
    const seen: string[] = [];
    subscribe("evidence.changed", (p) => {
      seen.push(p.userId);
    });

    await publish("evidence.changed", { userId: "u1", reason: "created" });

    expect(seen).toEqual(["u1"]);
  });

  it("fans out to every subscriber of the same event", async () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribe("evidence.changed", a);
    subscribe("evidence.changed", b);

    await publish("evidence.changed", { userId: "u1", reason: "updated" });

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it("does not deliver to subscribers of other events", async () => {
    const other = vi.fn();
    subscribe("portfolio.published", other);

    await publish("evidence.changed", { userId: "u1", reason: "created" });

    expect(other).not.toHaveBeenCalled();
  });

  it("awaits async subscribers so their effects land before publish resolves", async () => {
    let done = false;
    subscribe("evidence.changed", async () => {
      await new Promise((r) => setTimeout(r, 10));
      done = true;
    });

    await publish("evidence.changed", { userId: "u1", reason: "created" });

    expect(done).toBe(true); // would be false if publish didn't await
  });

  // The load-bearing guarantee: a publisher is reporting something that ALREADY
  // happened. A broken addon must never fail the user's write.
  it("isolates a throwing subscriber and still runs the others", async () => {
    const good = vi.fn();
    subscribe("evidence.changed", () => {
      throw new Error("addon exploded");
    });
    subscribe("evidence.changed", good);

    await expect(
      publish("evidence.changed", { userId: "u1", reason: "created" }),
    ).resolves.toBeUndefined();
    expect(good).toHaveBeenCalledOnce();
  });

  it("isolates a rejecting async subscriber", async () => {
    subscribe("evidence.changed", async () => {
      throw new Error("async addon exploded");
    });

    await expect(
      publish("evidence.changed", { userId: "u1", reason: "created" }),
    ).resolves.toBeUndefined();
  });

  it("publishing with no subscribers is a no-op", async () => {
    await expect(
      publish("evidence.changed", { userId: "u1", reason: "created" }),
    ).resolves.toBeUndefined();
  });

  it("unsubscribe detaches the handler", async () => {
    const h = vi.fn();
    const off = subscribe("evidence.changed", h);
    expect(subscriberCount("evidence.changed")).toBe(1);

    off();
    await publish("evidence.changed", { userId: "u1", reason: "created" });

    expect(subscriberCount("evidence.changed")).toBe(0);
    expect(h).not.toHaveBeenCalled();
  });
});
