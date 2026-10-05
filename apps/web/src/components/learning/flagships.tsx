"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

import {
  refreshFlagshipsAction,
  startFlagshipAction,
} from "@/app/dashboard/learning/flagship-actions";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/format/date";
import type { Flagship } from "@/lib/learning/flagship-rules";

/**
 * The two or three substantial projects for this direction, each answering a current business
 * problem with its sources shown — so the person can see the problem is real before committing
 * weeks to it.
 */
export function FlagshipProjects({
  flagships,
  refreshedAt,
  underWay,
}: {
  flagships: Flagship[];
  refreshedAt: string | null;
  /** Titles already committed to, so they read as under way rather than offered again. */
  underWay: string[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [starting, setStarting] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const taken = new Set(underWay.map((title) => title.toLowerCase().trim()));

  const refresh = () =>
    start(async () => {
      setNote(null);
      const result = await refreshFlagshipsAction();
      if (!result.ok) setNote(result.message ?? "Couldn't refresh just now.");
      router.refresh();
    });

  const take = (title: string) =>
    start(async () => {
      setNote(null);
      setStarting(title);
      const result = await startFlagshipAction({ title });
      setStarting(null);
      if (!result.ok) return setNote(result.message ?? "Couldn't start it.");
      if (result.runId) router.push(`/dashboard/learning/projects/${result.runId}`);
      else router.refresh();
    });

  if (flagships.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 p-5">
        <p className="text-sm text-muted-foreground">
          Two or three substantial projects, each answering a problem organisations are dealing with
          right now — researched from this month&apos;s news and matched to your record and the
          roles you are pursuing.
        </p>
        <Button className="mt-3" size="sm" disabled={busy} onClick={refresh}>
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          {busy ? "Researching…" : "Find my flagship projects"}
        </Button>
        {note ? <p className="mt-2 text-xs text-amber-500">{note}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-4 lg:grid-cols-3">
        {flagships.map((flagship) => {
          const underWayNow = taken.has(flagship.title.toLowerCase().trim());
          return (
            <article
              key={flagship.title}
              className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <h3 className="font-semibold leading-snug">{flagship.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{flagship.scope}</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-xs font-medium text-primary">The problem</dt>
                  <dd>{flagship.problem}</dd>
                </div>
                {flagship.whyNow ? (
                  <div>
                    <dt className="text-xs font-medium text-primary">Why now</dt>
                    <dd className="text-muted-foreground">{flagship.whyNow}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs font-medium text-primary">You build</dt>
                  <dd className="text-muted-foreground">{flagship.build}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-primary">Then break it</dt>
                  <dd className="text-muted-foreground">{flagship.breakIt}</dd>
                </div>
                {flagship.buildsOn ? (
                  <div>
                    <dt className="text-xs font-medium text-primary">Builds on</dt>
                    <dd className="text-muted-foreground">{flagship.buildsOn}</dd>
                  </div>
                ) : null}
              </dl>
              {flagship.sources.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-border/60 pt-2">
                  {flagship.sources.slice(0, 3).map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-start gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                        <span className="line-clamp-1">{source.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-auto pt-4">
                {underWayNow ? (
                  <p className="text-xs font-medium text-primary">Under way</p>
                ) : (
                  <Button size="sm" disabled={busy} onClick={() => take(flagship.title)}>
                    {starting === flagship.title ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : null}
                    {starting === flagship.title ? "Planning…" : "Take this on"}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          Researched {formatDay(refreshedAt) || "recently"};
          refreshed weekly so the problems stay current.
        </span>
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <RefreshCw
            className={`size-3 ${busy && !starting ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Research again
        </button>
        {note ? <span className="text-amber-500">{note}</span> : null}
      </div>
    </div>
  );
}
