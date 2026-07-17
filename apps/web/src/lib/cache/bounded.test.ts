import { describe, expect, it } from "vitest";

import { BoundedTtlCache } from "./bounded";

/** A controllable clock so TTL/eviction are deterministic. */
function clock(start = 1000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("BoundedTtlCache", () => {
  it("returns a live value and drops it once expired", () => {
    const c = clock();
    const cache = new BoundedTtlCache<number>(100, 10, c.now);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    c.advance(100); // exactly at TTL → expired
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0); // expired read evicts
  });

  it("NEVER grows past max — the leak this class exists to prevent", () => {
    const c = clock();
    const cache = new BoundedTtlCache<number>(10_000, 50, c.now);
    for (let i = 0; i < 5000; i++) cache.set(`k${i}`, i);
    expect(cache.size).toBeLessThanOrEqual(50);
  });

  it("evicts expired entries before resorting to oldest-out", () => {
    const c = clock();
    const cache = new BoundedTtlCache<number>(100, 3, c.now);
    cache.set("old", 1);
    c.advance(150); // "old" is now expired
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("d", 4); // size hits cap → expired "old" is reclaimed, b/c/d survive
    expect(cache.get("old")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
    expect(cache.get("d")).toBe(4);
  });

  it("evicts the OLDEST when nothing is expired", () => {
    const c = clock();
    const cache = new BoundedTtlCache<number>(10_000, 2, c.now);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3); // cap=2, nothing expired → oldest "a" goes
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });

  it("refreshing a key resets its age so it isn't the next evicted", () => {
    const c = clock();
    const cache = new BoundedTtlCache<number>(10_000, 2, c.now);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 11); // re-set moves "a" to newest
    cache.set("c", 3); // now "b" is oldest and evicted, not "a"
    expect(cache.get("a")).toBe(11);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });

  it("rejects a nonsensical capacity", () => {
    expect(() => new BoundedTtlCache<number>(100, 0)).toThrow();
  });
});
