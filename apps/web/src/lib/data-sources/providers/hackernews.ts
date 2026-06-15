/**
 * Hacker News (Algolia Search API) — leading indicator of where tech & AI are
 * heading. Free, no key. We use it as a skill-trend signal: highly-upvoted recent
 * stories mentioning the user's field/skills reveal what the modern industry is
 * moving toward, so Fadi can tell the user what to learn next.
 * https://hn.algolia.com/api
 */

import type { DataSourceCapability, MarketSignal, SignalQuery, SignalSource } from "../types";

const HN_SEARCH_API = "https://hn.algolia.com/api/v1/search";

type HnHit = {
  objectID: string;
  title?: string;
  url?: string;
  created_at?: string; // ISO
  points?: number;
  num_comments?: number;
};

export class HackerNewsSource implements SignalSource {
  readonly id = "hackernews";
  readonly name = "Hacker News (skill trends)";
  readonly isConfigured = true; // keyless
  readonly capabilities: DataSourceCapability[] = ["skill_trend"];
  readonly cost = "free" as const;

  async fetchSignals(query: SignalQuery): Promise<MarketSignal[]> {
    const terms = query.keywords.slice(0, 4).filter(Boolean);
    if (terms.length === 0) return [];

    const params = new URLSearchParams({
      query: terms.join(" "),
      tags: "story",
      numericFilters: "points>40", // only stories with real traction
      hitsPerPage: String(Math.min(query.limit ?? 15, 40)),
    });

    try {
      const res = await fetch(`${HN_SEARCH_API}?${params}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];

      const data = (await res.json()) as { hits?: HnHit[] };
      const hits = data.hits ?? [];

      return hits
        .filter((h) => h.title)
        .map((h) => ({
          sourceId: this.id,
          kind: "skill_trend" as const,
          title: h.title!.trim(),
          summary:
            h.points !== undefined
              ? `${h.points} points · ${h.num_comments ?? 0} comments`
              : undefined,
          url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
          publishedAt: h.created_at,
          // Which of the queried skills this story mentions — drives relevance.
          skills: terms.filter((t) => h.title!.toLowerCase().includes(t.toLowerCase())),
          regions: [],
          sectors: [],
        }));
    } catch {
      return [];
    }
  }
}
