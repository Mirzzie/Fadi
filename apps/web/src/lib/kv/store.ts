/**
 * Shared key-value seam — the multi-instance correctness layer. Rate limits, the
 * liveness cache, and the job-sync TTL were process-local Maps, which silently
 * break with 2+ instances (limits multiply, caches miss, duplicate external
 * pulls). This store uses Upstash Redis over REST when configured (zero new
 * dependencies, serverless-friendly) and falls back to an in-memory
 * implementation otherwise — identical behaviour on a single instance today,
 * production-correct the moment the env keys are set.
 */

export interface KvStore {
  get(key: string): Promise<string | null>;
  /** Set with optional TTL in seconds. */
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  /**
   * Atomic claim: set the key with TTL ONLY if it does not already exist (SET NX EX).
   * Returns true when THIS caller created it. This is the correct primitive for a
   * single-winner lock — a separate get()+set() has a race window where two concurrent
   * requests both see "absent" and both proceed (duplicate crawls).
   */
  setNx(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  del(key: string): Promise<void>;
  /**
   * Atomic increment. When the key is created by this call and `ttlSeconds` > 0,
   * the window TTL is set. Returns the new count and the remaining TTL (-1 = none).
   */
  incr(key: string, ttlSeconds?: number): Promise<{ count: number; ttlSeconds: number }>;
  /** Decrement, deleting at <= 0 (refund semantics). */
  decr(key: string): Promise<void>;
}

// ── In-memory (single instance / tests) ─────────────────────────────────────

type MemEntry = { value: string; expiresAt: number | null };

export class MemoryKv implements KvStore {
  private store = new Map<string, MemEntry>();

  private live(key: string): MemEntry | null {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt !== null && e.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return e;
  }

  async get(key: string): Promise<string | null> {
    return this.live(key)?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.store.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    // Atomic on a single-threaded event loop: there is no await between the liveness
    // check and the write, so two interleaved callers cannot both observe "absent".
    if (this.live(key)) return false;
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return true;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async incr(key: string, ttlSeconds?: number): Promise<{ count: number; ttlSeconds: number }> {
    const e = this.live(key);
    if (!e) {
      const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
      this.store.set(key, { value: "1", expiresAt });
      return { count: 1, ttlSeconds: ttlSeconds ?? -1 };
    }
    const count = (parseInt(e.value, 10) || 0) + 1;
    e.value = String(count);
    const ttl =
      e.expiresAt === null ? -1 : Math.max(1, Math.ceil((e.expiresAt - Date.now()) / 1000));
    return { count, ttlSeconds: ttl };
  }

  async decr(key: string): Promise<void> {
    const e = this.live(key);
    if (!e) return;
    const count = (parseInt(e.value, 10) || 0) - 1;
    if (count <= 0) this.store.delete(key);
    else e.value = String(count);
  }
}

// ── Upstash Redis over REST (multi-instance production) ─────────────────────

class UpstashKv implements KvStore {
  constructor(
    private readonly url: string,
    private readonly token: string
  ) {}

  private async cmd(...args: (string | number)[]): Promise<unknown> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args.map(String)),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`kv ${args[0]} failed: ${res.status}`);
    const json = (await res.json()) as { result?: unknown };
    return json.result ?? null;
  }

  async get(key: string): Promise<string | null> {
    const r = await this.cmd("GET", key);
    return r === null ? null : String(r);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) await this.cmd("SET", key, value, "EX", ttlSeconds);
    else await this.cmd("SET", key, value);
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    // Redis SET key value NX EX ttl → "OK" when set, null when the key already existed.
    const r = await this.cmd("SET", key, value, "NX", "EX", ttlSeconds);
    return r === "OK";
  }

  async del(key: string): Promise<void> {
    await this.cmd("DEL", key);
  }

  async incr(key: string, ttlSeconds?: number): Promise<{ count: number; ttlSeconds: number }> {
    const count = Number(await this.cmd("INCR", key));
    if (count === 1 && ttlSeconds) await this.cmd("EXPIRE", key, ttlSeconds);
    const ttl = Number(await this.cmd("TTL", key));
    return { count, ttlSeconds: ttl };
  }

  async decr(key: string): Promise<void> {
    const count = Number(await this.cmd("DECR", key));
    if (count <= 0) await this.cmd("DEL", key);
  }
}

// ── Singleton resolution ─────────────────────────────────────────────────────

const globalForKv = globalThis as typeof globalThis & { careerosKv?: KvStore };

export function getKv(): KvStore {
  if (!globalForKv.careerosKv) {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    globalForKv.careerosKv = url && token ? new UpstashKv(url, token) : new MemoryKv();
  }
  return globalForKv.careerosKv;
}
