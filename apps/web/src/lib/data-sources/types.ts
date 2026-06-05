/**
 * Real-time data source abstraction. Mirrors lib/ai/providers — every external
 * source is a pluggable provider with an honest `isConfigured` flag. No key →
 * the source reports itself unavailable; we never fabricate data.
 *
 * See docs/DATA_SOURCES_AND_REALTIME_INTELLIGENCE.md for the full catalog.
 */

export type DataSourceCapability =
  | "job_listings"
  | "job_liveness"
  | "labor_market"
  | "salary"
  | "news_signal" // geopolitical / economic events
  | "skill_trend"; // AI / tech skill momentum

export type DataSourceCost = "free" | "freemium" | "paid";

/** A normalized market signal — the canonical shape every news/trend source maps to. */
export interface MarketSignal {
  sourceId: string;
  kind: "news" | "skill_trend" | "labor";
  title: string;
  summary?: string;
  url?: string;
  publishedAt?: string; // ISO
  /** Entities extracted/known: skills, companies, regions, sectors. Powers relevance. */
  skills: string[];
  regions: string[];
  sectors: string[];
  /** -1 (negative) .. 1 (positive), when the source provides tone. */
  sentiment?: number;
}

/** A normalized live job posting. */
export interface JobPosting {
  sourceId: string;
  externalId: string;
  title: string;
  company: string;
  location?: string;
  remote?: boolean;
  url?: string;
  description?: string;
  tags: string[];
  postedAt?: string; // ISO
  /** Human-readable salary, when the source provides it (e.g. Adzuna "70k–95k"). */
  salaryText?: string;
}

export interface SignalQuery {
  /** Role + skills + sectors to search for (already derived from the user profile). */
  keywords: string[];
  regions?: string[];
  /** ISO-3166 alpha-2 country code (lowercase), e.g. "gb", "us" — for sources that scope by country. */
  country?: string;
  /** City / area within the country, e.g. "Dublin" — maps to Adzuna's `where`. */
  city?: string;
  limit?: number;
}

/** Base descriptor every source exposes. */
export interface DataSourceBase {
  readonly id: string;
  readonly name: string;
  readonly isConfigured: boolean;
  readonly capabilities: DataSourceCapability[];
  readonly cost: DataSourceCost;
}

/** Geopolitical/economic news + AI/skill-trend sources return MarketSignals. */
export interface SignalSource extends DataSourceBase {
  fetchSignals(query: SignalQuery): Promise<MarketSignal[]>;
}

/** Job board / aggregator / ATS sources return live postings. */
export interface JobSource extends DataSourceBase {
  fetchJobs(query: SignalQuery): Promise<JobPosting[]>;
  /**
   * Liveness check: is this posting still open / accepting applications?
   * Returns null when the source cannot determine it.
   */
  checkLiveness?(externalId: string): Promise<boolean | null>;
}

export function isSignalSource(s: DataSourceBase): s is SignalSource {
  return (s as SignalSource).fetchSignals !== undefined;
}

export function isJobSource(s: DataSourceBase): s is JobSource {
  return (s as JobSource).fetchJobs !== undefined;
}
