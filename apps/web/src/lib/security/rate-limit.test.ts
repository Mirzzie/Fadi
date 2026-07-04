import { describe, expect, it } from "vitest";

import { consumeRateLimit, refundRateLimit } from "./rate-limit";

describe("consumeRateLimit (KV-backed fixed window)", () => {
  it("allows up to the limit, blocks past it, and refunds restore an attempt", async () => {
    const key = `test:${Date.now()}`;
    const opts = { key, limit: 2, windowMs: 60_000 };

    const a = await consumeRateLimit(opts);
    const b = await consumeRateLimit(opts);
    const c = await consumeRateLimit(opts);
    expect(a.allowed).toBe(true);
    expect(a.remaining).toBe(1);
    expect(b.allowed).toBe(true);
    expect(b.remaining).toBe(0);
    expect(c.allowed).toBe(false);
    expect(c.retryAfterSeconds).toBeGreaterThan(0);

    // Refund twice (the blocked attempt also incremented) → one attempt back.
    await refundRateLimit(key);
    await refundRateLimit(key);
    const d = await consumeRateLimit(opts);
    expect(d.allowed).toBe(true);
  });
});
