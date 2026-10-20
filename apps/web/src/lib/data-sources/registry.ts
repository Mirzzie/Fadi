import "server-only";

import { serverEnv } from "@/lib/env.server";

import { WebCrawlSource } from "./providers/web-crawl-source";
import { WebSurferSource } from "./providers/web-surfer-source";
import { BlsSource } from "./providers/bls";
import { GdeltSource } from "./providers/gdelt";
import { HackerNewsSource } from "./providers/hackernews";
import { FadiScraperSource } from "./providers/fadi-scraper";
import { JoobleSource } from "./providers/jooble";
import { LightcastSkillsSource } from "./providers/lightcast";
import { ReedSource } from "./providers/reed";
import {
  isJobSource,
  isSignalSource,
  type DataSourceBase,
  type DataSourceCapability,
  type JobSource,
  type SignalSource,
} from "./types";

/**
 * Registry of real-time data sources. Sources register once and are filtered by
 * `isConfigured`. See docs/DATA_SOURCES_AND_REALTIME_INTELLIGENCE.md.
 *
 * WHY THIS LIST IS SHORT, and must stay short.
 *
 * It used to hold eleven job sources. Measured over the owner's whole database — every posting
 * pulled between 12 June and 23 September 2026 — five of them produced 533 of the 567 postings
 * that were live, in their market and on their roles. The other six produced 34 between them,
 * and Arbeitnow alone pushed 2,487 German postings through dedupe, relevance and liveness on
 * every single search to yield twenty-one.
 *
 * A source that cannot serve the person's market is not "extra coverage"; it is a tax on every
 * query and a list of green dots that means nothing. Before adding one back, measure what it
 * returns FOR THE MARKET IT WILL BE ASKED ABOUT, and give it `covers()` so it reports no
 * coverage instead of an empty page. See docs/FADI_AGENT_DESIGN.md.
 */
let _sources: DataSourceBase[] | null = null;

function buildSources(): DataSourceBase[] {
  return [
    // ── Market signals (not job boards) ──
    new GdeltSource(), // geopolitical / economic news_signal
    new HackerNewsSource(), // AI / skill_trend
    new BlsSource(), // labor_market — real US gov data (keyless v1; BLS_API_KEY → v2)
    new LightcastSkillsSource(serverEnv.LIGHTCAST_CLIENT_ID, serverEnv.LIGHTCAST_CLIENT_SECRET),

    // ── Job sources: the five that earn their place ──
    new WebSurferSource(), // Fadi's own: verified Greenhouse/Lever boards, keyless
    new WebCrawlSource(), // Fadi's own: searches the open web, then visits the page
    new JoobleSource(serverEnv.JOOBLE_API_KEY), // global aggregator, real Ireland coverage
    new ReedSource(serverEnv.REED_API_KEY), // UK + Ireland, with salary
    // Fadi's own browser automation — the strongest single source for this market. Registered
    // LAST on purpose: discoverJobs is first-wins, so the licensed APIs above keep attribution
    // when the same vacancy appears on both, and a scraped copy only fills fields they left blank.
    new FadiScraperSource(
      serverEnv.FADI_SCRAPER_ENABLED === "1" || serverEnv.FADI_SCRAPER_ENABLED === "true",
    ),
  ];
}

function getSources(): DataSourceBase[] {
  if (!_sources) _sources = buildSources();
  return _sources;
}

export function getConfiguredSignalSources(): SignalSource[] {
  return getSources().filter((s): s is SignalSource => s.isConfigured && isSignalSource(s));
}

export function getConfiguredJobSources(): JobSource[] {
  return getSources().filter((s): s is JobSource => s.isConfigured && isJobSource(s));
}

export function getSourcesForCapability(capability: DataSourceCapability): DataSourceBase[] {
  return getSources().filter((s) => s.isConfigured && s.capabilities.includes(capability));
}

/** Honest status list for UI/settings: which sources are live, which need a key. */
export function listSourceStatus(): Array<{
  id: string;
  name: string;
  capabilities: DataSourceCapability[];
  cost: DataSourceBase["cost"];
  configured: boolean;
}> {
  return getSources().map((s) => ({
    id: s.id,
    name: s.name,
    capabilities: s.capabilities,
    cost: s.cost,
    configured: s.isConfigured,
  }));
}

export function resetDataSourceRegistry(): void {
  _sources = null;
}
