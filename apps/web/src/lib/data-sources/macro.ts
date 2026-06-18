/**
 * Live macro signals from FRED (Federal Reserve Economic Data) — inflation, the
 * policy rate, and unemployment. The "money/inflation" axis of the wisdom window.
 *
 * Honesty: FRED is US data and needs a free key — when FRED_API_KEY isn't set we
 * return null and the UI says so (never a fabricated number). Every reading ends
 * in a CONTROLLABLE move (psychological-lens mandate): macro is positioning
 * information, never doom. Pure helpers (computeYoY / *Reading) are unit-testable;
 * getMacroSnapshot does the I/O and never throws.
 */

export type MacroReading = {
  id: "inflation" | "rate" | "unemployment";
  label: string;
  value: string;
  /** Plain-English read of the number. */
  reading: string;
  /** What the user can actually DO about it. */
  move: string;
};

export type MacroSnapshot = {
  asOf: string;
  readings: MacroReading[];
  source: string;
};

export type Observation = { date: string; value: number };

/** Parse FRED observations, dropping missing values ("."). Order is preserved. */
export function parseObservations(json: unknown): Observation[] {
  const obs = (json as { observations?: Array<{ date?: string; value?: string }> })?.observations ?? [];
  return obs
    .filter((o) => o.value && o.value !== "." && o.date)
    .map((o) => ({ date: o.date as string, value: Number(o.value) }))
    .filter((o) => Number.isFinite(o.value));
}

/**
 * Year-over-year % change from a DESC-sorted monthly series (newest first).
 * Compares the latest value to the one ~12 months earlier. Null when there isn't
 * a full year of data.
 */
export function computeYoY(descObservations: Observation[]): number | null {
  if (descObservations.length < 13) return null;
  const latest = descObservations[0].value;
  const yearAgo = descObservations[12].value;
  if (!yearAgo) return null;
  return ((latest - yearAgo) / yearAgo) * 100;
}

export function inflationReading(yoyPct: number): MacroReading {
  const reading =
    yoyPct >= 4
      ? "Prices are climbing fast — well above the ~2% comfort zone."
      : yoyPct >= 2.5
        ? "Inflation is running a little hot."
        : yoyPct >= 0
          ? "Inflation is mild and roughly normal."
          : "Prices are falling (deflation) — unusual, and usually a sign of weak demand.";
  return {
    id: "inflation",
    label: "Inflation (CPI, YoY)",
    value: `${yoyPct.toFixed(1)}%`,
    reading,
    move:
      yoyPct >= 2.5
        ? `A flat salary quietly loses ~${yoyPct.toFixed(0)}% of its value this year. Re-benchmark your pay and treat your next review or offer as a negotiation, not a formality.`
        : "Pay pressure is easing, but still re-benchmark your salary to market before you accept any offer — that number compounds.",
  };
}

export function rateReading(ratePct: number): MacroReading {
  const reading =
    ratePct >= 4
      ? "Borrowing is expensive — hiring tends to cool in rate-sensitive fields (real estate, construction, VC-funded startups)."
      : ratePct >= 2
        ? "Rates are moderate — a fairly neutral hiring backdrop."
        : "Money is cheap — that usually fuels hiring and risk-taking.";
  return {
    id: "rate",
    label: "Policy rate (Fed funds)",
    value: `${ratePct.toFixed(2)}%`,
    reading,
    move:
      ratePct >= 4
        ? "Weight your targeting toward cash-flow-positive, essential-demand employers over rate-exposed ones, and keep more options open in parallel."
        : "A supportive backdrop for hiring — a reasonable time to aim a notch higher or explore a stretch move.",
  };
}

export function unemploymentReading(ratePct: number): MacroReading {
  const reading =
    ratePct < 4.5
      ? "Tight labor market — candidates have real leverage."
      : ratePct < 6
        ? "A broadly balanced labor market."
        : "Slack market — searches run longer right now. That's the market, not a verdict on you.";
  return {
    id: "unemployment",
    label: "Unemployment",
    value: `${ratePct.toFixed(1)}%`,
    reading,
    move:
      ratePct < 4.5
        ? "Use the leverage: negotiate, and lean on referrals to move fast while employers compete."
        : "Widen your targeting and lean hard on referrals — they cut through a crowded market. Expect a longer timeline and protect your momentum; it's normal.",
  };
}

const FRED_BASE = "https://api.stlouisfred.com/fred/series/observations";

async function fredSeries(seriesId: string, apiKey: string, limit: number): Promise<Observation[]> {
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: "json",
    sort_order: "desc",
    limit: String(limit),
  });
  const res = await fetch(`${FRED_BASE}?${params}`, {
    headers: { "User-Agent": "FadiOS/1.0 (career intelligence)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  return parseObservations(await res.json());
}

/**
 * Live US macro snapshot. Returns null when FRED_API_KEY isn't configured (the UI
 * then offers to add it) and tolerates per-series failures — a series that doesn't
 * answer is simply omitted, never faked.
 */
export async function getMacroSnapshot(): Promise<MacroSnapshot | null> {
  const { serverEnv } = await import("@/lib/env.server");
  const apiKey = serverEnv.FRED_API_KEY;
  if (!apiKey) return null;

  try {
    const [cpi, fedFunds, unrate] = await Promise.all([
      fredSeries("CPIAUCSL", apiKey, 13),
      fredSeries("FEDFUNDS", apiKey, 1),
      fredSeries("UNRATE", apiKey, 1),
    ]);

    const readings: MacroReading[] = [];
    const yoy = computeYoY(cpi);
    if (yoy !== null) readings.push(inflationReading(yoy));
    if (fedFunds[0]) readings.push(rateReading(fedFunds[0].value));
    if (unrate[0]) readings.push(unemploymentReading(unrate[0].value));

    if (readings.length === 0) return null;
    return { asOf: new Date().toISOString(), readings, source: "FRED (St. Louis Fed)" };
  } catch {
    return null;
  }
}
