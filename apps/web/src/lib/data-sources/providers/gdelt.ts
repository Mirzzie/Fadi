/**
 * GDELT 2.0 — global geopolitical & economic event signal. Free, no API key,
 * updates every 15 minutes. Best free source for "what's happening in the world
 * that affects this user's job market" (layoffs, sector shocks, regional events).
 * https://api.gdeltproject.org/api/v2/doc/doc
 */

import type { DataSourceCapability, MarketSignal, SignalQuery, SignalSource } from "../types";

const GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc";

type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string; // e.g. "20260601T120000Z"
  domain?: string;
  sourcecountry?: string;
};

function parseSeenDate(seendate?: string): string | undefined {
  if (!seendate || seendate.length < 15) return undefined;
  // 20260601T120000Z → 2026-06-01T12:00:00Z
  const d = `${seendate.slice(0, 4)}-${seendate.slice(4, 6)}-${seendate.slice(6, 8)}T${seendate.slice(9, 11)}:${seendate.slice(11, 13)}:${seendate.slice(13, 15)}Z`;
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

// GDELT updates every ~15 min and rate-limits to one request per 5 s. We cache
// per-query so we don't re-hit it inside that window, and serve a slightly older
// (but still real) result when a request is throttled or times out — degrading
// gracefully instead of dropping all geopolitical context. Never fabricated.
const FRESH_TTL_MS = 15 * 60 * 1000; // within this, skip the network entirely
const STALE_TTL_MS = 60 * 60 * 1000; // on fetch failure, serve cache up to this age
const CACHE_MAX = 300;
const cache = new Map<string, { at: number; signals: MarketSignal[] }>();

/**
 * Store a result while keeping the cache bounded. Two-tier TTL means we can't use the
 * single-TTL BoundedTtlCache (an entry past FRESH but under STALE is still useful for
 * failure-fallback), so bound it here: drop entries older than STALE_TTL (never served
 * again), then evict oldest until under the cap. Without this the Map grew for the life
 * of the process — one entry per distinct query — a slow leak.
 */
function putInCache(key: string, signals: MarketSignal[]): void {
  const now = Date.now();
  if (cache.size >= CACHE_MAX) {
    for (const [k, v] of cache) {
      if (now - v.at >= STALE_TTL_MS) cache.delete(k);
    }
    while (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }
  cache.delete(key);
  cache.set(key, { at: now, signals });
}

export class GdeltSource implements SignalSource {
  readonly id = "gdelt";
  readonly name = "GDELT (global events)";
  readonly isConfigured = true; // keyless — always available
  readonly capabilities: DataSourceCapability[] = ["news_signal"];
  readonly cost = "free" as const;

  async fetchSignals(query: SignalQuery): Promise<MarketSignal[]> {
    // GDELT rejects the entire query with "The specified phrase is too short."
    // when any quoted term has no word of at least 3 chars (e.g. "AI", "ML").
    // That error comes back as HTTP 200 with a plain-text body, so we must drop
    // such terms up front rather than let them poison the whole request.
    const terms = query.keywords
      .filter(Boolean)
      .filter((t) => t.split(/\s+/).some((word) => word.length >= 3))
      .slice(0, 3);
    if (terms.length === 0) return [];

    // GDELT query: OR the terms, scope to job-market relevant language.
    const q = `(${terms.map((t) => `"${t}"`).join(" OR ")}) (layoff OR hiring OR jobs OR economy)`;
    const limit = Math.min(query.limit ?? 15, 50);
    const cacheKey = `${q}::${limit}`;

    const cached = cache.get(cacheKey);
    const age = cached ? Date.now() - cached.at : Infinity;
    if (cached && age < FRESH_TTL_MS) return cached.signals;

    const fresh = await this.request(q, limit);
    if (fresh) {
      putInCache(cacheKey, fresh);
      return fresh;
    }

    // Request failed (rate-limited, timed out, or malformed): serve the last
    // real result if it's still recent enough, otherwise no signal (no fakes).
    if (cached && age < STALE_TTL_MS) return cached.signals;
    return [];
  }

  /** One GDELT call. Returns null on any failure so the caller can fall back to cache. */
  private async request(q: string, limit: number): Promise<MarketSignal[] | null> {
    const params = new URLSearchParams({
      query: q,
      mode: "ArtList",
      format: "json",
      maxrecords: String(limit),
      sort: "DateDesc",
    });

    try {
      const res = await fetch(`${GDELT_DOC_API}?${params}`, {
        headers: { "User-Agent": "Fadi/1.0 (career intelligence)" },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return null;

      // GDELT signals query problems (rate limits, malformed terms) with a
      // plain-text 200 body, not JSON. Treat a non-JSON body as a failure so it
      // never looks like a successful empty result.
      if (!res.headers.get("content-type")?.includes("json")) return null;

      const data = (await res.json()) as { articles?: GdeltArticle[] };
      const articles = data.articles ?? [];

      return articles
        .filter((a) => a.title && a.url)
        .map((a) => ({
          sourceId: this.id,
          kind: "news" as const,
          title: a.title!.trim(),
          url: a.url,
          publishedAt: parseSeenDate(a.seendate),
          skills: [],
          regions: a.sourcecountry ? [a.sourcecountry] : [],
          sectors: [],
        }));
    } catch {
      return null;
    }
  }
}
