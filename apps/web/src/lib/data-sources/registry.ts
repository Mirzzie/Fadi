import "server-only";

import { GdeltSource } from "./providers/gdelt";
import { HackerNewsSource } from "./providers/hackernews";
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
    // ── Phase B/C providers register here as they're implemented:
    //   new AdzunaSource(serverEnv.ADZUNA_APP_ID, serverEnv.ADZUNA_APP_KEY),
    //   new BlsSource(serverEnv.BLS_API_KEY), new OnetSource(...), etc.
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
