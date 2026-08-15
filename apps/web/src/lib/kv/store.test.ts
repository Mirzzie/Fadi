import { describe, expect, it, vi } from "vitest";

import { MemoryKv } from "./store";

describe("MemoryKv", () => {
  it("get/set/del round-trips with TTL expiry", async () => {
    vi.useFakeTimers();
    const kv = new MemoryKv();
    await kv.set("a", "1", 10);
    expect(await kv.get("a")).toBe("1");
    vi.advanceTimersByTime(11_000);
    expect(await kv.get("a")).toBeNull(); // expired
    await kv.set("b", "x");
    await kv.del("b");
    expect(await kv.get("b")).toBeNull();
    vi.useRealTimers();
  });

  it("incr creates with TTL, counts up, and decr deletes at zero", async () => {
    const kv = new MemoryKv();
    const first = await kv.incr("n", 60);
    expect(first.count).toBe(1);
    expect(first.ttlSeconds).toBe(60);
    const second = await kv.incr("n", 60);
    expect(second.count).toBe(2);
    await kv.decr("n");
    await kv.decr("n");
    expect(await kv.get("n")).toBeNull(); // refunded to zero → gone
  });

  it("setNx claims once: the first caller wins, the rest fail until TTL expiry", async () => {
    vi.useFakeTimers();
    const kv = new MemoryKv();
    // Single-winner lock: exactly one of N racers may claim the key.
    expect(await kv.setNx("lock", "1", 30)).toBe(true);
    expect(await kv.setNx("lock", "1", 30)).toBe(false);
    expect(await kv.setNx("lock", "1", 30)).toBe(false);
    // After the window expires the key is free to claim again.
    vi.advanceTimersByTime(31_000);
    expect(await kv.setNx("lock", "1", 30)).toBe(true);
    vi.useRealTimers();
  });
});
