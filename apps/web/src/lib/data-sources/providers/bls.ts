/**
 * US Bureau of Labor Statistics — real government labor data as a registry signal
 * source. Wraps the existing `getLaborMarketSnapshot()` (national unemployment,
 * JOLTS openings, quits) so that data — today only used at career-report time —
 * also flows through the live market-intelligence fan-out onto the dashboard and
 * into Fadi's per-message context. Keyless (BLS v1); a BLS_API_KEY upgrades the
 * underlying call to v2 (handled inside the labor module).
 *
 * The labor module is `server-only`, so it's pulled via dynamic import inside
 * fetchSignals — keeping this file (and its pure normalizer) import-safe for unit
 * tests. Note: BLS OEWS occupation wages are NOT served by the public timeseries
 * API (flat-file only), so wage signals are intentionally left to a follow-on.
 */

import type { DataSourceCapability, MarketSignal, SignalQuery, SignalSource } from "../types";

/** BLS reports a period label ("May 2026"); `publishedAt` is contractually ISO. */
function labelToIso(label?: string | null): string | undefined {
  if (!label) return undefined;
  const d = new Date(label);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Pure: turn a labor snapshot into a market signal (structural param → testable). */
export function snapshotToSignal(
  snap: { summary: string; asOf?: string | null },
  keywords: string[],
): MarketSignal | null {
  if (!snap.summary) return null;
  return {
    sourceId: "bls",
    kind: "labor",
    title: snap.summary,
    url: "https://www.bls.gov/data/",
    publishedAt: labelToIso(snap.asOf),
    // Attach the user's terms so this macro signal ranks as relevant context
    // rather than being filtered out by the relevance threshold.
    skills: keywords.slice(0, 3),
    regions: ["US", "United States"],
    sectors: [],
  };
}

export class BlsSource implements SignalSource {
  readonly id = "bls";
  readonly name = "US Bureau of Labor Statistics";
  readonly capabilities: DataSourceCapability[] = ["labor_market"];
  readonly cost = "free" as const;
  readonly isConfigured = true; // keyless (BLS v1); BLS_API_KEY upgrades to v2

  async fetchSignals(query: SignalQuery): Promise<MarketSignal[]> {
    try {
      // Dynamic import keeps the `server-only` labor module out of this file's
      // top-level graph (so unit tests can import the pure normalizer + class).
      const { getLaborMarketSnapshot } = await import("@/lib/labor-market/bls");
      const snap = await getLaborMarketSnapshot();
      const signal = snapshotToSignal(snap, query.keywords);
      return signal ? [signal] : [];
    } catch {
      return [];
    }
  }
}
