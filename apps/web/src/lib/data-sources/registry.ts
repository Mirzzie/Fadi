import "server-only";

import { serverEnv } from "@/lib/env.server";

import { AdzunaSource } from "./providers/adzuna";
import { ApifyLinkedInSource } from "./providers/apify-linkedin";
import { ArbeitnowSource } from "./providers/arbeitnow";
import { MuseSource } from "./providers/themuse";
import { WebCrawlSource } from "./providers/web-crawl-source";
import { WebSurferSource } from "./providers/web-surfer-source";
import { BlsSource } from "./providers/bls";
import { GdeltSource } from "./providers/gdelt";
import { HackerNewsSource } from "./providers/hackernews";
import { FadiScraperSource } from "./providers/fadi-scraper";
import { IndeedPublicSource } from "./providers/indeed-public";
import { JoobleSource } from "./providers/jooble";
import { LinkedInGuestSource } from "./providers/linkedin-guest";
import { JSearchSource } from "./providers/jsearch";
import { LightcastSkillsSource } from "./providers/lightcast";
import { ReedSource } from "./providers/reed";
import { RemotiveSource } from "./providers/remotive";
import {
  isJobSource,
  isSignalSource,
  type DataSourceBase,
  type DataSourceCapability,
  type JobSource,
  type SignalSource,
} from "./types";

/**
 * Registry of real-time data sources. Mirrors lib/ai/registry — sources are
 * registered once and filtered by `isConfigured`. The three reference providers
 * are keyless (always available); keyed sources (Adzuna, JSearch, BLS, O*NET,
 * FRED, news APIs) register here too and self-report unavailable until their
 * env key is set. See docs/DATA_SOURCES_AND_REALTIME_INTELLIGENCE.md.
 */
let _sources: DataSourceBase[] | null = null;

function buildSources(): DataSourceBase[] {
  return [
    // ── Phase A: free, keyless (active now) ──
    new GdeltSource(), // geopolitical / economic news_signal
    new HackerNewsSource(), // AI / skill_trend
    new RemotiveSource(), // live job_listings
    new ArbeitnowSource(), // live job_listings (EU / ATS)
    new MuseSource(), // FREE + KEYLESS, cross-industry, location-searchable — covers Ireland
    new WebSurferSource(), // ALWAYS-ON: sweeps verified Greenhouse/Lever boards — fresh, keyless
    new WebCrawlSource(), // searches the open web (Brave key) → visits pages → non-expired jobs
    new BlsSource(), // labor_market — real US gov data (keyless v1; BLS_API_KEY → v2)
    // ── Phase B: keyed sources — self-report unavailable until their env key is set ──
    new AdzunaSource(serverEnv.ADZUNA_APP_ID, serverEnv.ADZUNA_APP_KEY), // jobs + salary, ~19 countries (NOT Ireland)
    new ReedSource(serverEnv.REED_API_KEY), // jobs + salary, UK + Ireland
    new JoobleSource(serverEnv.JOOBLE_API_KEY), // global aggregator, covers Ireland
    new JSearchSource(serverEnv.JSEARCH_RAPIDAPI_KEY), // Google for Jobs (LinkedIn/Indeed/etc.), compliant
    // ── Free, keyed: self-report unavailable until creds are set ──
    new LightcastSkillsSource(serverEnv.LIGHTCAST_CLIENT_ID, serverEnv.LIGHTCAST_CLIENT_SECRET), // skill_trend
    // ── Opt-in scraping: OFF unless APIFY_TOKEN set; operator owns the ToS call ──
    new ApifyLinkedInSource(serverEnv.APIFY_TOKEN, serverEnv.APIFY_LINKEDIN_ACTOR),
    // ── Direct scrapers (JobSpy method port): OFF unless SCRAPERS_ENABLED=1 ──
    // Registered LAST on purpose. discoverJobs dedupes first-wins, so the licensed
    // APIs above keep attribution when the same job appears on both, and a scraped
    // copy only ever fills in fields they left blank.
    new LinkedInGuestSource(), // public guest endpoint, no credential
    new IndeedPublicSource(), // public search page, no credential
    // Fadi's own browser-automation scraper — human-flow across API-less sites. Off unless
    // FADI_SCRAPER_ENABLED, so it self-reports unavailable (like the keyed APIs) by default.
    new FadiScraperSource(
      serverEnv.FADI_SCRAPER_ENABLED === "1" || serverEnv.FADI_SCRAPER_ENABLED === "true",
    ),
    //   new OnetSource(...), new FredSource(...), new WarnSource(...), etc.
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
