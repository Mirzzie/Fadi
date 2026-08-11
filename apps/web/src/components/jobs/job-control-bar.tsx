"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Moon, Radio } from "lucide-react";

import { cn } from "@/lib/utils";
import { saveJobPreferences } from "@/app/dashboard/jobs/actions";
import type { JobSourceHealth } from "@/lib/data-sources/service";

// One slim control strip that replaces the two heavy "Background job search" and "Live job
// sources" cards. The search bar above is the primary action and the board below is the
// content — this is deliberately quiet, with both halves behind progressive disclosure.

type Health = "returning" | "live-empty" | "error" | "needs-key";

function healthOf(s: JobSourceHealth): Health {
  if (!s.configured) return "needs-key";
  if (s.lastRun?.status === "error") return "error";
  if (s.lastRun && s.lastRun.count > 0) return "returning";
  return "live-empty";
}

const DOT: Record<Health, string> = {
  returning: "bg-emerald-400",
  "live-empty": "bg-amber-400",
  error: "bg-rose-400",
  "needs-key": "bg-muted-foreground/40",
};

const LABEL: Record<Health, string> = {
  returning: "returning jobs",
  "live-empty": "no jobs last pull",
  error: "error last pull",
  "needs-key": "needs an API key",
};

export function JobControlBar({
  sources,
  lastRunAt,
  activeModes,
  activeTypes,
  autoSearch: initialAutoSearch,
}: {
  sources: JobSourceHealth[];
  lastRunAt: number | null;
  activeModes: string[];
  activeTypes: string[];
  autoSearch: boolean;
}) {
  const [autoSearch, setAutoSearch] = useState(initialAutoSearch);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const configured = sources.filter((s) => s.configured).length;
  const returning = sources.filter((s) => healthOf(s) === "returning").length;
  const changed = autoSearch !== initialAutoSearch;
  const filterSummary = [
    activeModes.length ? activeModes.join("/") : "any mode",
    activeTypes.length ? activeTypes.join("/") : "any type",
  ].join(" · ");

  function save() {
    startTransition(async () => {
      await saveJobPreferences({ modes: activeModes, types: activeTypes, autoSearch, agentScope: "filters" });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <section className="rounded-xl border bg-card/40">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
        {/* Left — background auto-search, inline */}
        <div className="flex items-center gap-2 text-sm">
          <label className="flex cursor-pointer items-center gap-2" title={`Runs with: ${filterSummary}. Never auto-applies.`}>
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
              <span className="font-medium text-foreground">{returning}</span> of {configured} sources live
            </>
          ) : (
            <>{configured} sources configured</>
          )}
          <ChevronDown className={cn("size-3.5 transition-transform", sourcesOpen && "rotate-180")} aria-hidden="true" />
        </button>
      </div>

      {sourcesOpen ? (
        <div className="space-y-1.5 border-t px-4 py-3">
          {sources.map((s) => {
            const h = healthOf(s);
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className={cn("size-2 shrink-0 rounded-full", DOT[h])} aria-hidden="true" />
                  <span className={cn(!s.configured && "text-muted-foreground")}>{s.name}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {s.lastRun && s.configured ? `${s.lastRun.count} last pull · ` : ""}
                  {LABEL[h]}
                </span>
              </div>
            );
          })}
          <p className="pt-1 text-xs text-muted-foreground">
            &ldquo;Returning&rdquo; means the source answered on the last live pull. A source can be configured but
            quiet for a role/region — that&rsquo;s normal. Counts are pre-filter.
          </p>
        </div>
      ) : null}
    </section>
  );
}
