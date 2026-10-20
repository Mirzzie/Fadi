import "server-only";

import { serverEnv } from "@/lib/env.server";

// Web-search discovery for the crawler. Fadi can't scrape Google/Bing/DuckDuckGo directly (all
// bot-walled server-side — verified), so it needs a search backend. Three, in priority order,
// all with a ZERO-BUDGET path first:
//   1. SearXNG  — self-hosted metasearch (Docker), FREE, no key, no limits. SEARXNG_URL.
//   2. Google Programmable Search — 100/day free, no card. GOOGLE_CSE_KEY + GOOGLE_CSE_CX.
//   3. Brave Search API — if a key is ever set. BRAVE_SEARCH_API_KEY.
// With none configured this returns [] and the crawler self-reports unavailable — honest.

export type SearchHit = { url: string; title?: string; snippet?: string };

// Hosts the extension (walled) or the APIs/surfer already own — skip so the crawler spends its
// budget on the OPEN web (company career pages, niche boards) it uniquely reaches.
const SKIP_HOSTS =
  /(^|\.)(linkedin|indeed|glassdoor|ziprecruiter|facebook|twitter|x|reddit|youtube|wikipedia|pinterest)\./i;

export function webSearchConfigured(): boolean {
  return Boolean(
    serverEnv.SEARXNG_URL ||
      (serverEnv.GOOGLE_CSE_KEY && serverEnv.GOOGLE_CSE_CX) ||
      serverEnv.BRAVE_SEARCH_API_KEY,
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** SearXNG `format=json` → hits. Pure. */
export function parseSearxng(json: any): SearchHit[] {
  const results = json?.results;
  if (!Array.isArray(results)) return [];
  return results
    .map((r: any) => ({ url: String(r?.url ?? ""), title: r?.title, snippet: r?.content }))
    .filter((r: SearchHit) => r.url.startsWith("http"));
}

/**
 * Did SearXNG actually search, or did every engine turn it away?
 *
 * A local instance is rate-limited and CAPTCHA'd by the big engines within a few queries. The
 * response is still 200 with an empty `results` — indistinguishable, downstream, from "there are
 * no such jobs". Measured 21 Sep 2026: three query variants in a row came back empty with
 * duckduckgo on CAPTCHA and brave suspended, and the crawler reported a clean zero for Dublin.
 * Empty results WITH every engine unresponsive is a failed search, and is reported as one.
 */
export function searxngSearchFailed(json: any): boolean {
  const results = Array.isArray(json?.results) ? json.results : [];
  if (results.length > 0) return false;
  const dead = json?.unresponsive_engines;
  return Array.isArray(dead) && dead.length > 0;
}

/** Google Programmable Search `items` → hits. Pure. */
export function parseGoogle(json: any): SearchHit[] {
  const items = json?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map((r: any) => ({ url: String(r?.link ?? ""), title: r?.title, snippet: r?.snippet }))
    .filter((r: SearchHit) => r.url.startsWith("http"));
}

/** Brave Search `web.results` → hits. Pure. */
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

async function getJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(7000) });
  if (!res.ok) throw new Error(`search ${res.status}`);
  return res.json();
}

// Bias the search to ATS/career hosts Fadi can actually READ server-side. The open web's big
// job boards (irishjobs, jobs.ie, Indeed, LinkedIn) 403 a server bot — verified — so an
// unbiased search just finds walls. These hosts return 200 and carry structured JobPosting data.
const CRAWLABLE_BIAS =
  "(site:greenhouse.io OR site:lever.co OR site:ashbyhq.com OR site:workable.com OR site:bamboohr.com OR site:smartrecruiters.com)";

/** Search the open web for job pages. Returns [] (never throws) with no backend / on failure. */
export async function searchJobUrls(keywords: string, location: string, limit = 12): Promise<SearchHit[]> {
  const q = [keywords, location, CRAWLABLE_BIAS].filter(Boolean).join(" ").trim();
  const enc = encodeURIComponent(q);
  try {
    // 1) SearXNG — free, self-hosted, unlimited.
    if (serverEnv.SEARXNG_URL) {
      const base = serverEnv.SEARXNG_URL.replace(/\/$/, "");
      const json = await getJson(`${base}/search?q=${enc}&format=json&categories=general`);
      if (searxngSearchFailed(json)) {
        throw new Error("every engine the local SearXNG asked was rate-limited or blocked");
      }
      return keepCrawlable(parseSearxng(json)).slice(0, limit);
    }
    // 2) Google Programmable Search — 100/day free.
    if (serverEnv.GOOGLE_CSE_KEY && serverEnv.GOOGLE_CSE_CX) {
      const u = `https://www.googleapis.com/customsearch/v1?key=${serverEnv.GOOGLE_CSE_KEY}&cx=${serverEnv.GOOGLE_CSE_CX}&num=10&q=${enc}`;
      return keepCrawlable(parseGoogle(await getJson(u))).slice(0, limit);
    }
    // 3) Brave — if a key is set.
    if (serverEnv.BRAVE_SEARCH_API_KEY) {
      const u = `https://api.search.brave.com/res/v1/web/search?q=${enc}&count=20`;
      return keepCrawlable(parseBrave(await getJson(u, { "X-Subscription-Token": serverEnv.BRAVE_SEARCH_API_KEY }))).slice(0, limit);
    }
  } catch (error) {
    // A search backend that cannot be reached is NOT "no results". SEARXNG_URL pointed at a
    // container that was not running, so every crawl returned zero in milliseconds and the UI
    // reported the crawler as live with nothing found (measured 20 Sep 2026). The caller turns
    // this into a source error, which the board shows as a failure the person can retry.
    throw new SearchBackendUnavailable(error instanceof Error ? error.message : "search failed");
  }
  return [];
}

/** The configured search backend could not be reached. Distinct from "it found nothing". */
export class SearchBackendUnavailable extends Error {
  constructor(detail: string) {
    super(`The web-search backend is not reachable (${detail}).`);
    this.name = "SearchBackendUnavailable";
  }
}
