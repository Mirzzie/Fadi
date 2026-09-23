"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Moon, Radio } from "lucide-react";

import { cn } from "@/lib/utils";
import { saveJobPreferences } from "@/app/dashboard/jobs/actions";
import type { JobSourceHealth } from "@/lib/data-sources/service";

// One slim control strip that replaces the two heavy "Background job search" and "Live job
// sources" cards. The search bar above is the primary action and the board below is the
// content — this is deliberately quiet, with both halves behind progressive disclosure.

type Health =
  | "returning"
  | "live-empty"
  | "error"
  | "idle"
  | "needs-key"
  | "off-optin"
  /** The source does not serve the country being searched — not a failure, not an empty market. */
  | "no-coverage";

// These sources are SCRAPERS gated by a feature flag (FADI_SCRAPER_ENABLED / SCRAPERS_ENABLED)
// — they take NO API key. Server-side scraping is largely blocked anyway; the browser
// extension does this in the user's own session instead.
const SCRAPER_IDS = new Set(["fadi-scraper"]);

function healthOf(s: JobSourceHealth): Health {
  if (!s.configured) return SCRAPER_IDS.has(s.id) ? "off-optin" : "needs-key";
  if (s.lastRun?.status === "unsupported_here") return "no-coverage";
  if (s.lastRun?.status === "error") return "error";
  if (!s.lastRun) return "idle"; // configured, but no pull has run this session yet
  if (s.lastRun.count > 0) return "returning";
  return "live-empty";
}

const DOT: Record<Health, string> = {
  returning: "bg-emerald-400",
  "live-empty": "bg-amber-400",
  error: "bg-rose-400",
  idle: "bg-sky-400",
  "needs-key": "bg-muted-foreground/40",
  "off-optin": "bg-muted-foreground/40",
  "no-coverage": "bg-muted-foreground/40",
};

const LABEL: Record<Health, string> = {
  returning: "answered",
  "live-empty": "nothing for this search",
  error: "failed",
  idle: "not searched yet",
  "needs-key": "needs an API key",
  "off-optin": "off · no key needed",
  "no-coverage": "doesn't cover this country",
};

/**
 * What to say about one source, in the order a person cares about it: what it put on your
 * board, then what it returned, then how it went.
 *
 * "Returning jobs" was the old line, and it was the wrong fact. A source can answer with two
 * hundred postings and put none in front of you — Arbeitnow did exactly that for months before
 * it was retired — and a row of green dots said everything was fine.
 */
function sourceLine(source: JobSourceHealth, onBoard: number, health: Health): string {
  if (!source.configured || health === "no-coverage") return LABEL[health];
  const parts: string[] = [];
  if (onBoard > 0) parts.push(`${onBoard} on your board`);
  if (source.lastRun) parts.push(`${source.lastRun.count} returned`);
  parts.push(LABEL[health]);
  return parts.join(" · ");
}

export function JobControlBar({
  sources,
  onBoard = {},
  lastRunAt,
  activeModes,
  activeTypes,
  autoSearch: initialAutoSearch,
}: {
  sources: JobSourceHealth[];
  /** Postings from each source that actually made it onto the board, keyed by source id. */
  onBoard?: Record<string, number>;
  lastRunAt: number | null;
  activeModes: string[];
  activeTypes: string[];
  autoSearch: boolean;
}) {
  const [autoSearch, setAutoSearch] = useState(initialAutoSearch);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sourcesOpen, setSourcesOpen] = useState(false);

  // Hide the server-side scraper sources unless they're actually enabled: off, they can't
  // return jobs (blocked server-side) and only prompt "why is this off?". The real scraping
  // paths are the browser extension (walled sites) and the Web Surfer (open web).
  const visible = sources.filter((s) => s.configured || !SCRAPER_IDS.has(s.id));
  const configured = visible.filter((s) => s.configured).length;
  const returning = visible.filter((s) => healthOf(s) === "returning").length;
  const changed = autoSearch !== initialAutoSearch;
  const filterSummary = [
    activeModes.length ? activeModes.join("/") : "any mode",
    activeTypes.length ? activeTypes.join("/") : "any type",
  ].join(" · ");

  function save() {
    startTransition(async () => {
      await saveJobPreferences({
        modes: activeModes,
        types: activeTypes,
        autoSearch,
        agentScope: "filters",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <section className="rounded-xl border bg-card/40">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
        {/* Left — background auto-search, inline */}
        <div className="flex items-center gap-2 text-sm">
          <label
            className="flex cursor-pointer items-center gap-2"
            title={`Runs with: ${filterSummary}. Never auto-applies.`}
          >
            <input
              type="checkbox"
              checked={autoSearch}
              onChange={(e) => setAutoSearch(e.target.checked)}
              className="size-4 accent-primary"
            />
            <Moon className="size-3.5 text-primary" aria-hidden="true" />
            <span className="font-medium">Auto-search while away</span>
          </label>
          {changed ? (
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          ) : saved ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
              <Check className="size-3.5" aria-hidden="true" /> Saved
            </span>
          ) : null}
        </div>

        {/* Right — live source status, expandable */}
        <button
          type="button"
          onClick={() => setSourcesOpen((o) => !o)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          aria-expanded={sourcesOpen}
        >
          <Radio className="size-3.5 text-primary" aria-hidden="true" />
          {lastRunAt ? (
            <>
              <span className="font-medium text-foreground">{returning}</span> of {configured}{" "}
              sources live
            </>
          ) : (
            <>{configured} sources ready · search to check</>
          )}
          <ChevronDown
            className={cn("size-3.5 transition-transform", sourcesOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </div>

      {sourcesOpen ? (
        <div className="space-y-1.5 border-t px-4 py-3">
          {visible.map((s) => {
            const h = healthOf(s);
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className={cn("size-2 shrink-0 rounded-full", DOT[h])} aria-hidden="true" />
                  <span className={cn(!s.configured && "text-muted-foreground")}>{s.name}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {sourceLine(s, onBoard[s.id] ?? 0, h)}
                </span>
              </div>
            );
          })}
          <p className="pt-1 text-xs text-muted-foreground">
            &ldquo;On your board&rdquo; is what survived matching — the number that matters.
            &ldquo;Returned&rdquo; is what the source sent back before filtering. A source can
            answer with plenty and still give you nothing, which is why both are shown. Walled sites
            (LinkedIn/Indeed) aren&rsquo;t here — the browser extension reads those in your own
            session.
          </p>
        </div>
      ) : null}
    </section>
  );
}
