import "server-only";

import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/observability/logger";

/**
 * US labor-market snapshot from the Bureau of Labor Statistics — real government
 * data, grounding Fadi's market context (replaces the old "marketDemand not
 * implemented" placeholder). Works KEYLESS (BLS v1, ~25 req/day); a BLS_API_KEY
 * upgrades to v2 (500/day). Cached aggressively — these series update monthly.
 */

const SERIES = {
  unemployment: "LNS14000000", // civilian unemployment rate, % (SA)
  openings: "JTS000000000000000JOL", // JOLTS job openings, level in thousands (SA)
  quitsRate: "JTS000000000000000QUR", // JOLTS quits rate, % (SA) — worker confidence
} as const;

export type Trend = "up" | "down" | "flat";

export type LaborSnapshot = {
  unemploymentRate: number | null;
  unemploymentTrend: Trend | null;
  jobOpeningsMillions: number | null;
  openingsTrend: Trend | null;
  quitsRate: number | null;
  asOf: string | null;
  /** One-line honest summary for Fadi to cite. Empty when no data. */
  summary: string;
};

const TTL_MS = 12 * 60 * 60 * 1000; // refresh twice a day at most
let cache: { at: number; snap: LaborSnapshot } | null = null;

const EMPTY: LaborSnapshot = {
  unemploymentRate: null,
  unemploymentTrend: null,
  jobOpeningsMillions: null,
  openingsTrend: null,
  quitsRate: null,
  asOf: null,
  summary: "",
};

function trend(curr: number | null, prev: number | null): Trend | null {
  if (curr == null || prev == null) return null;
  if (curr > prev) return "up";
  if (curr < prev) return "down";
  return "flat";
}

export async function getLaborMarketSnapshot(): Promise<LaborSnapshot> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.snap;

  const key = serverEnv.BLS_API_KEY;
  const year = new Date().getFullYear();
  const url = key
    ? "https://api.bls.gov/publicAPI/v2/timeseries/data/"
    : "https://api.bls.gov/publicAPI/v1/timeseries/data/";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seriesid: Object.values(SERIES),
        startyear: String(year - 1),
        endyear: String(year),
        ...(key ? { registrationkey: key } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return cache?.snap ?? EMPTY;

    const data = (await res.json()) as {
      status?: string;
      Results?: { series?: Array<{ seriesID: string; data?: Array<{ value: string; periodName: string; year: string }> }> };
    };
    const byId = new Map((data.Results?.series ?? []).map((s) => [s.seriesID, s.data ?? []]));
    const point = (id: string) => {
      const d = byId.get(id);
      if (!d || d.length === 0) return null;
      return {
        value: parseFloat(d[0].value),
        prev: d[1] ? parseFloat(d[1].value) : null,
        label: `${d[0].periodName} ${d[0].year}`,
      };
    };

    const unemp = point(SERIES.unemployment);
    const open = point(SERIES.openings);
    const quits = point(SERIES.quitsRate);
    if (!unemp && !open) return cache?.snap ?? EMPTY;

    const openingsM = open ? open.value / 1000 : null;
    const verbU =
      unemp && unemp.prev != null
        ? trend(unemp.value, unemp.prev) === "up"
          ? "ticking up"
          : trend(unemp.value, unemp.prev) === "down"
            ? "easing"
            : "steady"
        : "";
    const verbO =
      open && open.prev != null
        ? trend(open.value, open.prev) === "up"
          ? "rising"
          : trend(open.value, open.prev) === "down"
            ? "cooling"
            : "flat"
        : "";

    const snap: LaborSnapshot = {
      unemploymentRate: unemp?.value ?? null,
      unemploymentTrend: unemp ? trend(unemp.value, unemp.prev) : null,
      jobOpeningsMillions: openingsM,
      openingsTrend: open ? trend(open.value, open.prev) : null,
      quitsRate: quits?.value ?? null,
      asOf: unemp?.label ?? open?.label ?? null,
      summary: [
        `US labor market (BLS, ${unemp?.label ?? open?.label ?? "latest"}):`,
        unemp ? `unemployment ${unemp.value}%${verbU ? ` and ${verbU}` : ""};` : "",
        openingsM != null ? `${openingsM.toFixed(1)}M job openings${verbO ? ` and ${verbO}` : ""};` : "",
        quits ? `quits rate ${quits.value}% (worker confidence).` : "",
      ]
        .filter(Boolean)
        .join(" "),
    };

    cache = { at: Date.now(), snap };
    logger.info("labor_market.bls", { asOf: snap.asOf, source: key ? "v2" : "v1-keyless" });
    return snap;
  } catch {
    return cache?.snap ?? EMPTY;
  }
}
