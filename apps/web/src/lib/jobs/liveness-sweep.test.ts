import { describe, expect, it, vi } from "vitest";

import { needsLivenessProbe, sweepJobsLiveness, type SweepableJob } from "./liveness-sweep";
import type { PostingLiveness } from "./liveness-detect";

const NOW = 1_700_000_000_000;
const TTL = 12 * 60 * 60 * 1000;

describe("needsLivenessProbe", () => {
  it("skips jobs with no URL", () => {
    expect(needsLivenessProbe({ id: "a", url: null, livenessCheckedAt: null }, NOW, TTL)).toBe(false);
  });

  it("probes a never-checked posting", () => {
    expect(needsLivenessProbe({ id: "a", url: "https://x/1", livenessCheckedAt: null }, NOW, TTL)).toBe(true);
  });

  it("skips a recently-checked posting, reprobes a stale one", () => {
    const fresh = new Date(NOW - 60_000).toISOString();
    const stale = new Date(NOW - TTL - 60_000).toISOString();
    expect(needsLivenessProbe({ id: "a", url: "https://x/1", livenessCheckedAt: fresh }, NOW, TTL)).toBe(false);
    expect(needsLivenessProbe({ id: "a", url: "https://x/1", livenessCheckedAt: stale }, NOW, TTL)).toBe(true);
  });
});

describe("sweepJobsLiveness", () => {
  const job = (id: string, url: string | null): SweepableJob => ({ id, url, livenessCheckedAt: null });
  const resolve = (state: PostingLiveness["state"]): PostingLiveness => ({ state, checkedAt: "x" });

  it("persists every probe result and returns only the closed ids", async () => {
    const persist = vi.fn(async () => {});
    const check = vi.fn(async (url: string) =>
      resolve(url.endsWith("/closed") ? "closed" : url.endsWith("/unknown") ? "unknown" : "live"),
    );

    const closed = await sweepJobsLiveness(
      [job("a", "https://x/live"), job("b", "https://x/closed"), job("c", "https://x/unknown")],
      { check, persist },
      { now: NOW },
    );

    expect([...closed]).toEqual(["b"]);
    expect(persist).toHaveBeenCalledWith("a", "live");
    expect(persist).toHaveBeenCalledWith("b", "closed");
    expect(persist).toHaveBeenCalledWith("c", "unknown");
  });

  it("respects maxProbes and never probes a fresh posting", async () => {
    const fresh: SweepableJob = { id: "fresh", url: "https://x/1", livenessCheckedAt: new Date(NOW).toISOString() };
    const check = vi.fn(async () => resolve("live"));
    const persist = vi.fn(async () => {});

    await sweepJobsLiveness(
      [job("a", "https://x/a"), job("b", "https://x/b"), job("c", "https://x/c"), fresh],
      { check, persist },
      { now: NOW, maxProbes: 2 },
    );

    expect(check).toHaveBeenCalledTimes(2); // capped, and the fresh one is excluded
  });

  it("a failing probe doesn't abort the sweep", async () => {
    const check = vi.fn(async (url: string) => {
      if (url.endsWith("/boom")) throw new Error("network");
      return resolve("closed");
    });
    const persist = vi.fn(async () => {});

    const closed = await sweepJobsLiveness(
      [job("a", "https://x/boom"), job("b", "https://x/closed")],
      { check, persist },
      { now: NOW, concurrency: 1 },
    );

    expect([...closed]).toEqual(["b"]);
  });
});
