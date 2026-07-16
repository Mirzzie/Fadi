import { afterEach, describe, expect, it, vi } from "vitest";

import { __resetBusForTests, publish, subscribe } from "./bus";

vi.mock("@/lib/observability/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

afterEach(() => __resetBusForTests());

/**
 * The architecture test: does a fact published by ONE feature reach a DIFFERENT
 * feature that the publisher has never heard of?
 *
 * This is the property the whole "AIO" thesis rests on. Before the bus, the only
 * way for learning→portfolio to propagate was an import (i.e. coupling, and in
 * lib/ai's case, an actual cycle). These tests pin the seam so a refactor that
 * silently severs propagation fails CI instead of shipping.
 */
describe("cross-feature propagation (the AIO seam)", () => {
  it("learning completion reaches the portfolio without either importing the other", async () => {
    // Stand-in for lib/portfolio/subscribers.ts
    const portfolioReacted: string[] = [];
    subscribe("evidence.changed", ({ userId, reason }) => {
      portfolioReacted.push(`${userId}:${reason}`);
    });

    // What app/dashboard/learning/actions.ts does when a commitment completes.
    await publish("evidence.changed", {
      userId: "u1",
      reason: "learning_completed",
      evidenceItemId: "ev-1",
    });

    expect(portfolioReacted).toEqual(["u1:learning_completed"]);
  });

  it("one fact fans out to several independent addons", async () => {
    const portfolio = vi.fn();
    const futureResumeProjection = vi.fn(); // the next subscriber to be built
    subscribe("evidence.changed", portfolio);
    subscribe("evidence.changed", futureResumeProjection);

    await publish("evidence.changed", { userId: "u1", reason: "created" });

    expect(portfolio).toHaveBeenCalledOnce();
    expect(futureResumeProjection).toHaveBeenCalledOnce();
  });

  it("a broken addon cannot break the user's evidence write", async () => {
    const healthy = vi.fn();
    subscribe("evidence.changed", () => {
      throw new Error("third-party addon is broken");
    });
    subscribe("evidence.changed", healthy);

    // The publisher (saveEvidence) must still succeed.
    await expect(
      publish("evidence.changed", { userId: "u1", reason: "updated", evidenceItemId: "ev-1" }),
    ).resolves.toBeUndefined();
    expect(healthy).toHaveBeenCalledOnce();
  });

  it("carries ids, not snapshots — subscribers must re-read current state", async () => {
    let payloadKeys: string[] = [];
    subscribe("evidence.changed", (p) => {
      payloadKeys = Object.keys(p);
    });

    await publish("evidence.changed", { userId: "u1", reason: "created", evidenceItemId: "ev-1" });

    // No embedded evidence object: prevents subscribers acting on stale data.
    expect(payloadKeys.sort()).toEqual(["evidenceItemId", "reason", "userId"]);
  });
});
