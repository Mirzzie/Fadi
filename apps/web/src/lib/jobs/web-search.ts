import "server-only";

import { serverEnv } from "@/lib/env.server";

// Web-search discovery for the crawler. Fadi can't scrape Google/Bing/DuckDuckGo results
// (all bot-walled server-side — verified), so real internet search needs a search API. Brave
// Search has a free tier (~2k queries/month, one key). Without a key this returns [] and the
// crawler self-reports unavailable — honest, never a dark feature.

export type SearchHit = { url: string; title?: string; snippet?: string };

// Hosts the extension (walled) or the APIs/surfer already own — skip so the crawler spends its
// budget on the OPEN web (company career pages, niche boards) it uniquely reaches.
const SKIP_HOSTS =
  /(^|\.)(linkedin|indeed|glassdoor|ziprecruiter|facebook|twitter|x|reddit|youtube|wikipedia|pinterest)\./i;

export function webSearchConfigured(): boolean {
  return Boolean(serverEnv.BRAVE_SEARCH_API_KEY);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Parse Brave's web-search JSON into hits. Pure. */
export function parseBrave(json: any): SearchHit[] {
  const results = json?.web?.results;
  if (!Array.isArray(results)) return [];
  return results
    .map((r: any) => ({ url: String(r?.url ?? ""), title: r?.title, snippet: r?.description }))
    .filter((r: SearchHit) => r.url.startsWith("http"));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Drop walled/social hosts and de-dupe by host+path. Pure. */
export function keepCrawlable(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const h of hits) {
    let u: URL;
    try {
      u = new URL(h.url);
    } catch {
      continue;
    }
    if (SKIP_HOSTS.test(u.hostname)) continue;
    const key = u.hostname + u.pathname;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

/** Search the open web for job pages. Returns [] (never throws) with no key or on failure. */
export async function searchJobUrls(keywords: string, location: string, limit = 12): Promise<SearchHit[]> {
  const key = serverEnv.BRAVE_SEARCH_API_KEY;
  if (!key) return [];
  const q = [keywords, "jobs", location].filter(Boolean).join(" ").trim();
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=20`,
      { headers: { "X-Subscription-Token": key, Accept: "application/json" }, signal: AbortSignal.timeout(7000) },
    );
    if (!res.ok) return [];
    return keepCrawlable(parseBrave(await res.json())).slice(0, limit);
  } catch {
    return [];
  }
}
