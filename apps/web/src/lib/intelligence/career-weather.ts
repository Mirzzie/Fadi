/**
 * Career Weather — the "window of wisdom". Fuses three honest signal layers into
 * one personalized read of what's moving in the world AND what it means for THIS
 * user's path:
 *   1. Structural forces — the curated world-shifts catalog, ranked to their track.
 *   2. Live macro — FRED inflation / rates / unemployment (the money axis).
 *   3. Current affairs — live GDELT signals scored to their role.
 *
 * Non-negotiable (psychological-lens mandate): EVERY card ends in a controllable
 * move. This is positioning information, never a doom feed — the thing we protect
 * is the user's locus of control. Pure card builders are unit-testable; the
 * orchestrator loads server deps dynamically and never throws.
 */

import type { MacroReading } from "@/lib/data-sources/macro";
import type { ScoredSignal } from "@/lib/data-sources/relevance";
import type { ShiftRelevance } from "@/lib/intelligence/world-shifts";

export type WeatherTag = "pressure" | "tailwind" | "context" | "macro" | "news";

export type CareerWeatherCard = {
  kind: "shift" | "macro" | "news";
  tag: WeatherTag;
  title: string;
  /** The signal — what's happening. */
  whatsHappening: string;
  /** What it means for this user's path (may be empty for raw news). */
  meaning: string;
  /** The controllable move — always present. */
  move: string;
  url?: string;
  sources?: string;
};

export type CareerWeather = {
  track: { targetRole: string | null; domain: string | null };
  asOf: string;
  forces: CareerWeatherCard[];
  macro: CareerWeatherCard[];
  /** A live macro snapshot came back. */
  macroAvailable: boolean;
  /** A FRED key IS configured (so empty macro ⇒ a fetch/key problem, not "add a key"). */
  macroConfigured: boolean;
  currentAffairs: CareerWeatherCard[];
};

export function shiftToCard({ shift, relation }: ShiftRelevance): CareerWeatherCard {
  return {
    kind: "shift",
    tag: relation,
    title: shift.name,
    whatsHappening: shift.whatsHappening,
    meaning: shift.careerImplication,
    move: shift.positioningMove,
    sources: shift.sources,
  };
}

export function macroToCard(reading: MacroReading): CareerWeatherCard {
  return {
    kind: "macro",
    tag: "macro",
    title: `${reading.label}: ${reading.value}`,
    whatsHappening: reading.reading,
    meaning: "",
    move: reading.move,
    sources: "FRED (St. Louis Fed)",
  };
}

export function signalToCard(signal: ScoredSignal): CareerWeatherCard {
  return {
    kind: "news",
    tag: "news",
    title: signal.title,
    whatsHappening: signal.summary ?? "",
    meaning: signal.reasons[0] ?? "",
    // Honest locus-of-control framing: a single headline is context, not a trigger.
    move: "Treat this as one data point for your targeting — worth noting, not worth reacting to on its own.",
    url: signal.url,
  };
}

/** Build the personalized career-weather read for a user. */
export async function getCareerWeather(userId: string): Promise<CareerWeather> {
  const [{ getDashboardProfileSummary }, { relevantShiftsFor }, macroMod, { getMarketIntelligence }] =
    await Promise.all([
      import("@/lib/career-report/data"),
      import("@/lib/intelligence/world-shifts"),
      import("@/lib/data-sources/macro"),
      import("@/lib/data-sources/service"),
    ]);
  const { getMacroSnapshot, isMacroConfigured } = macroMod;

  const profile = await getDashboardProfileSummary(userId);
  const targetRole = profile?.targetRole ?? "";
  const domain = profile?.domain ?? null;

  const forces = relevantShiftsFor(targetRole, domain).slice(0, 4).map(shiftToCard);

  // Macro (FRED) and signals (GDELT) are independent external calls — run them in
  // PARALLEL and bound each, so this page renders in ~6s worst case instead of
  // ~12s sequential. Each falls back to "unavailable" on timeout/failure.
  const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

  const signalsP = targetRole
    ? getMarketIntelligence({ targetRole, skills: [], skillGaps: [], domain }, { limit: 3 })
        .then((intel) => intel.signals.slice(0, 3).map(signalToCard))
        .catch(() => [] as CareerWeatherCard[])
    : Promise.resolve([] as CareerWeatherCard[]);

  const [snapshot, macroConfigured, currentAffairs] = await Promise.all([
    withTimeout(getMacroSnapshot(), 6000, null),
    isMacroConfigured(),
    withTimeout(signalsP, 6000, [] as CareerWeatherCard[]),
  ]);
  const macro = snapshot ? snapshot.readings.map(macroToCard) : [];

  return {
    track: { targetRole: profile?.targetRole ?? null, domain },
    asOf: new Date().toISOString(),
    forces,
    macro,
    macroAvailable: snapshot !== null,
    macroConfigured,
    currentAffairs,
  };
}
