type RateLimitState = {
  count: number;
  resetAt: number;
};

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

const globalForRateLimit = globalThis as typeof globalThis & {
  careerosRateLimits?: Map<string, RateLimitState>;
};

function getStore() {
  if (!globalForRateLimit.careerosRateLimits) {
    globalForRateLimit.careerosRateLimits = new Map();
  }

  return globalForRateLimit.careerosRateLimits;
}

export function consumeRateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const store = getStore();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, {
      count: 1,
      resetAt,
    });

    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt: new Date(resetAt),
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(existing.resetAt),
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  store.set(key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    resetAt: new Date(existing.resetAt),
    retryAfterSeconds: 0,
  };
}

export function refundRateLimit(key: string) {
  const store = getStore();
  const existing = store.get(key);

  if (!existing) {
    return;
  }

  if (existing.count <= 1) {
    store.delete(key);
    return;
  }

  store.set(key, {
    ...existing,
    count: existing.count - 1,
  });
}
