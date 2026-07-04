import { getKv } from "@/lib/kv/store";

/**
 * Fixed-window rate limiting on the shared KV seam — correct across multiple
 * instances (the old per-process Map effectively multiplied every limit by the
 * instance count). Fails OPEN on KV errors: a broken cache must never lock users
 * out of their own app.
 */

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

export async function consumeRateLimit({ key, limit, windowMs }: RateLimitOptions): Promise<RateLimitResult> {
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  try {
    const { count, ttlSeconds } = await getKv().incr(`rl:${key}`, windowSeconds);
    const ttl = ttlSeconds > 0 ? ttlSeconds : windowSeconds;
    const resetAt = new Date(Date.now() + ttl * 1000);
    if (count > limit) {
      return { allowed: false, remaining: 0, resetAt, retryAfterSeconds: Math.max(1, ttl) };
    }
    return { allowed: true, remaining: Math.max(0, limit - count), resetAt, retryAfterSeconds: 0 };
  } catch {
    // Fail open — a cache outage should degrade to "no limit", not "no service".
    return { allowed: true, remaining: limit, resetAt: new Date(Date.now() + windowMs), retryAfterSeconds: 0 };
  }
}

/** Give an attempt back (e.g. the provider failed through no fault of the user). */
export async function refundRateLimit(key: string): Promise<void> {
  try {
    await getKv().decr(`rl:${key}`);
  } catch {
    // best-effort
  }
}
