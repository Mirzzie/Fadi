import "server-only";

import { serverEnv } from "@/lib/env.server";
import { parseSearxng, type SearchHit } from "@/lib/jobs/web-search";

/**
 * What organisations are dealing with THIS month, from the open web.
 *
 * Through the self-hosted SearXNG only — free, keyless and local, like the rest of Fadi's
 * research — and limited to the last month, so the problems projects are built around are
 * current rather than whatever a model remembers from its training. Returns [] when SearXNG is
 * not configured or not running; the caller says so instead of pretending it researched.
 */
export async function searchRecent(
  queries: string[],
  options: { perQuery?: number } = {}
): Promise<SearchHit[]> {
  if (!serverEnv.SEARXNG_URL) return [];
  const base = serverEnv.SEARXNG_URL.replace(/\/$/, "");
  const perQuery = options.perQuery ?? 5;

  const batches = await Promise.all(
    queries.map(async (query) => {
      const url = `${base}/search?q=${encodeURIComponent(query)}&format=json&categories=news,general&time_range=month`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (!res.ok) return [];
        return parseSearxng(await res.json()).slice(0, perQuery);
      } catch {
        return [];
      }
    })
  );

  const seen = new Set<string>();
  return batches.flat().filter((hit) => {
    if (seen.has(hit.url)) return false;
    seen.add(hit.url);
    return true;
  });
}
