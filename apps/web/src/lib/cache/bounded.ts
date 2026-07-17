/**
 * A bounded, TTL'd in-process cache.
 *
 * WHY THIS EXISTS: the market-intelligence cache was a raw `Map` whose TTL was checked
 * only on READ — so stale entries were never removed and the map grew without limit
 * for the life of the process. With a per-(role, region, skills, thresholds) key that
 * is high-cardinality across users, that's a slow memory leak on any long-running
 * node. This is the in-process hot cache (zero-latency, single-instance); the KV store
 * in lib/kv is the cross-instance one. Different jobs, both needed.
 *
 * Guarantees:
 *   - `get` never returns an expired entry (and deletes it on the way out).
 *   - `size` is bounded by `max`: `set` drops expired entries first, then evicts the
 *     oldest until under the cap. So the footprint is bounded no matter the traffic.
 *
 * Pure and synchronous — deterministic to test with an injectable clock.
 */
export class BoundedTtlCache<V> {
  private readonly store = new Map<string, { at: number; value: V }>();

  constructor(
    private readonly ttlMs: number,
    private readonly max: number,
    /** Injectable for tests; defaults to the wall clock. */
    private readonly now: () => number = Date.now,
  ) {
    if (max < 1) throw new Error("BoundedTtlCache max must be >= 1");
  }

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (this.now() - hit.at >= this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V): void {
    const t = this.now();
    if (this.store.size >= this.max) {
      // Expired-first, then oldest-out. Map iteration is insertion order, and a
      // re-set deletes before inserting, so the first key is always the oldest live one.
      for (const [k, v] of this.store) {
        if (t - v.at >= this.ttlMs) this.store.delete(k);
      }
      while (this.store.size >= this.max) {
        const oldest = this.store.keys().next().value;
        if (oldest === undefined) break;
        this.store.delete(oldest);
      }
    }
    this.store.delete(key); // move a refreshed key to the newest position
    this.store.set(key, { at: t, value });
  }

  /** Current entry count (including not-yet-evicted expired ones). Mainly for tests. */
  get size(): number {
    return this.store.size;
  }
}
