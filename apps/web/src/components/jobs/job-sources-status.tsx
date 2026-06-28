"use client";

import { useState } from "react";
import { ChevronDown, Radio } from "lucide-react";

import { cn } from "@/lib/utils";
import type { JobSourceHealth } from "@/lib/data-sources/service";

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

export function JobSourcesStatus({
  sources,
  lastRunAt,
}: {
  sources: JobSourceHealth[];
  lastRunAt: number | null;
}) {
  const [open, setOpen] = useState(false);
  const configured = sources.filter((s) => s.configured).length;
  const returning = sources.filter((s) => healthOf(s) === "returning").length;

  return (
    <section className="rounded-xl border bg-card p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Radio className="size-4 text-primary" aria-hidden="true" />
          Live job sources
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {lastRunAt
            ? `${returning} of ${configured} returning jobs`
            : `${configured} configured — search to check`}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
        </span>
      </button>

      {open ? (
        <div className="mt-3 space-y-1.5">
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
            &ldquo;Returning&rdquo; means the source answered with postings on the last live pull. A source can be
            configured but quiet for a specific role/region — that&rsquo;s normal, not a failure. Counts are pre-filter
            (before role/seniority matching).
          </p>
        </div>
      ) : null}
    </section>
  );
}
