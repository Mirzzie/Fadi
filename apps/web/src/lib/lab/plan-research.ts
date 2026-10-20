import "server-only";

import { serverEnv } from "@/lib/env.server";
import { htmlToText } from "@/lib/data-sources/sanitize";
import { parseSearxng, type SearchHit } from "@/lib/jobs/web-search";
import { fetchSafeUrl, readTextBodyLimited } from "@/lib/security/url-guard";

/**
 * A PROJECT IS PLANNED FROM TODAY'S INTERNET, NOT A MODEL'S MEMORY.
 *
 * Plans written from what a model remembered sent the owner to a Wazuh installer on GitHub
 * that has never existed there (404) and checked for a service name from an older release
 * (15 Oct 2026). Tools, versions, download links and commands change; a plan must come from
 * their current documentation. So before planning, Fadi searches the open web through its own
 * SearXNG (free, self-hosted), reads the top official pages, and hands them to the planner as
 * the source of truth — and after planning, every link in the plan is checked to exist.
 */

export type PlanSource = { url: string; title: string; text: string };

/** What to look up: the project itself, and each named tool's current install docs. */
export function planQueries(input: {
  title: string;
  detail?: string | null;
  labLabel?: string | null;
  tools?: string[];
}): string[] {
  const queries = [
    `${input.title} step by step guide${input.labLabel ? ` ${input.labLabel}` : ""}`,
    ...(input.tools ?? []).map((tool) => `${tool} official documentation installation`),
  ];
  return [...new Set(queries.map((q) => q.replace(/\s+/g, " ").trim()))].slice(0, 5);
}

/** Search without a news window: documentation is not news. */
async function search(queries: string[], perQuery: number): Promise<SearchHit[]> {
  if (!serverEnv.SEARXNG_URL) return [];
  const base = serverEnv.SEARXNG_URL.replace(/\/$/, "");
  const batches = await Promise.all(
    queries.map(async (query) => {
      const url = `${base}/search?q=${encodeURIComponent(query)}&format=json&categories=general`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        return res.ok ? parseSearxng(await res.json()).slice(0, perQuery) : [];
      } catch {
        return [];
      }
    })
  );
  const seen = new Set<string>();
  return batches.flat().filter((hit) => (seen.has(hit.url) ? false : (seen.add(hit.url), true)));
}

/** Official documentation first: vendors' own sites and docs subdomains beat blogs. */
export function rankSources(hits: SearchHit[], preferHosts: string[] = []): SearchHit[] {
  const score = (hit: SearchHit) => {
    let host = "";
    try {
      host = new URL(hit.url).hostname;
    } catch {
      return -10;
    }
    let s = 0;
    if (preferHosts.some((h) => host === h || host.endsWith(`.${h}`))) s += 10;
    if (/^docs?\.|documentation|learn\.microsoft\.com|^developer\./.test(host)) s += 5;
    if (/medium\.com|youtube\.com|reddit\.com|quora\.com|pinterest/.test(host)) s -= 5;
    return s;
  };
  return [...hits].sort((a, b) => score(b) - score(a));
}

async function readPage(url: string, maxChars: number): Promise<string> {
  try {
    const res = await fetchSafeUrl(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "Mozilla/5.0 (Fadi plan research)" },
    });
    if (!res.ok || !/text\/html|text\/plain/.test(res.headers.get("content-type") ?? "")) return "";
    const html = await readTextBodyLimited(res, 1024 * 1024);
    return relevantExcerpt(htmlToText(mainContent(html), 60_000), maxChars);
  } catch {
    return "";
  }
}

/**
 * The page's own content: scripts (JSON-LD metadata read as text otherwise), styles, SVG and
 * the site's navigation removed; its <main> or <article> when it has one.
 */
export function mainContent(html: string): string {
  const cleaned = html
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const main =
    /<main\b[\s\S]*?<\/main>/i.exec(cleaned)?.[0] ??
    /<article\b[\s\S]*?<\/article>/i.exec(cleaned)?.[0] ??
    /<div[^>]+role=["']main["'][\s\S]*$/i.exec(cleaned)?.[0];
  return main ?? cleaned;
}

/**
 * The part of a page a plan needs. Documentation pages open with navigation; the install
 * commands, download links and service names are further down. Lines are scored for what a
 * step uses — commands, links, versions, service and install words — and the best runs kept.
 */
export function relevantExcerpt(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const command = (line: string) => /^(?:[$>#]|PS\s|sudo\s)/.test(line);
  const score = (line: string) =>
    (/https?:\/\//.test(line) ? 2 : 0) +
    (/\b(msiexec|install|download|\.msi|\.deb|\.rpm|apt|dnf|winget|Invoke-WebRequest|curl|NET START|Start-Service|systemctl|service|config|version|\d+\.\d+\.\d+)\b/i.test(
      line
    )
      ? 3
      : 0) +
    (/[$>#]\s|--?\w+|\w+\.exe\b|\/[a-z]+\//i.test(line) ? 1 : 0) -
    (line.length < 25 && !command(line) ? 2 : 0) +
    (command(line) ? 2 : 0);
  // Keep each scoring line with its neighbour on either side, in page order.
  const keep = new Set<number>();
  lines.forEach((line, i) => {
    if (score(line) >= 3)
      [i - 1, i, i + 1].forEach((j) => j >= 0 && j < lines.length && keep.add(j));
  });
  const picked = [...keep].sort((a, b) => a - b).map((i) => lines[i]);
  const out = (picked.length ? picked : lines).join("\n");
  return out.slice(0, maxChars);
}

/** Search, rank, read. Empty when SearXNG is not running — the caller says so. */
export async function researchForPlan(input: {
  title: string;
  detail?: string | null;
  labLabel?: string | null;
  tools?: string[];
  preferHosts?: string[];
}): Promise<PlanSource[]> {
  const hits = rankSources(await search(planQueries(input), 5), input.preferHosts);
  const read = await Promise.all(
    hits.slice(0, 4).map(async (hit) => ({
      url: hit.url,
      title: hit.title ?? hit.url,
      text: await readPage(hit.url, 3500),
    }))
  );
  return read.filter((source) => source.text.length > 200);
}

export function researchForPrompt(sources: PlanSource[]): string {
  if (sources.length === 0) {
    return "CURRENT DOCUMENTATION: none could be fetched this time. Write only commands and links you are certain still exist, and prefer the vendor's own site.";
  }
  return [
    `CURRENT DOCUMENTATION, fetched ${new Date().toISOString().slice(0, 10)}. Take install commands, versions, service names and download links from these (or from the facts above) — never from memory, and never invent a URL:`,
    ...sources.map((s) => `--- ${s.title} (${s.url})\n${s.text}`),
  ].join("\n");
}

/** Every http(s) link a plan's steps mention. */
export function linksIn(texts: string[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(/https?:\/\/[^\s"'`<>)\]]+/g)) {
      // An XML namespace is an identifier, not a page: it 404s by design (Windows event
      // subscription XML failed a real plan for it, 15 Oct 2026).
      const before = text.slice(Math.max(0, (match.index ?? 0) - 12), match.index);
      if (/xmlns(?::\w+)?=\s*["']?$/i.test(before)) continue;
      const link = match[0].replace(/[.,;:]+$/, "");
      if (NAMESPACE_HOST.test(link)) continue;
      found.add(link);
    }
  }
  return [...found];
}

/** Hosts whose URLs are names, not pages. */
const NAMESPACE_HOST =
  /^https?:\/\/(?:schemas\.[\w.-]+|(?:www\.)?w3\.org|purl\.org|ns\.adobe\.com|xmlns\.\w+|schemas\.xmlsoap\.org)\//i;

/**
 * Links in a plan that do not exist. Only a definite "not there" counts (4xx/410); a site that
 * blocks robots or times out is not called broken, so a good plan is never rejected for it.
 */
export async function brokenLinks(texts: string[], skipHosts: string[] = []): Promise<string[]> {
  const links = linksIn(texts).filter((link) => {
    try {
      const host = new URL(link).hostname;
      // The lab's own addresses and placeholders are not on the internet.
      return (
        !skipHosts.includes(host) &&
        !/^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host) &&
        host.includes(".")
      );
    } catch {
      return false;
    }
  });
  const results = await Promise.all(
    links.slice(0, 10).map(async (link) => {
      try {
        let res = await fetchSafeUrl(link, {
          method: "HEAD",
          signal: AbortSignal.timeout(10_000),
        });
        // Some servers refuse HEAD; ask for one byte instead.
        if (res.status === 405 || res.status === 403) {
          res = await fetchSafeUrl(link, {
            headers: { range: "bytes=0-0" },
            signal: AbortSignal.timeout(10_000),
          });
        }
        return res.status === 404 || res.status === 410 ? link : null;
      } catch {
        return null;
      }
    })
  );
  return results.filter((link): link is string => link !== null);
}
