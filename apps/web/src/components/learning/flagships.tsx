"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

import {
  adoptFlagshipIdeaAction,
  refreshFlagshipsAction,
  setFlagshipAsideAction,
  startFlagshipAction,
} from "@/app/dashboard/learning/flagship-actions";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/format/date";
import { MAX_FLAGSHIPS, type Flagship, type FlagshipIdea } from "@/lib/learning/flagship-rules";

/**
 * The two or three substantial projects for this direction, each answering a current business
 * problem with its sources shown — so the person can see the problem is real before committing
 * weeks to it.
 */
export function FlagshipProjects({
  flagships,
  ideas = [],
  refreshedAt,
  underWay,
  secondary = false,
}: {
  flagships: Flagship[];
  /** New ideas from research and earlier ones — kept, never dropped. */
  ideas?: FlagshipIdea[];
  refreshedAt: string | null;
  /** Titles already committed to, so they read as under way rather than offered again. */
  underWay: string[];
  /** Continuing existing work stays the primary action on Learning. */
  secondary?: boolean;
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

  const change = (action: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      setNote(null);
      const result = await action();
      if (!result.ok) setNote(result.message ?? "That didn't work.");
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
      <div className="border-y border-dashed border-border bg-card/40 p-5">
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Find project ideas based on your career record and recent research. Review the sources
          and scope before choosing one.
        </p>
        <Button className="mt-3" variant={secondary ? "outline" : "default"} size="sm" disabled={busy} onClick={refresh}>
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          {busy ? "Researching…" : "Find my flagship projects"}
        </Button>
        {note ? <p className="mt-2 text-xs text-warning">{note}</p> : null}
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
              className="flex flex-col border border-border bg-card p-4"
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
                  <div className="flex items-center gap-3">
                    <Button size="sm" disabled={busy} onClick={() => take(flagship.title)}>
                      {starting === flagship.title ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : null}
                      {starting === flagship.title ? "Planning…" : "Take this on"}
                    </Button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        change(() => setFlagshipAsideAction({ title: flagship.title }))
                      }
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Set aside
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <FlagshipIdeas
        ideas={ideas}
        current={flagships}
        busy={busy}
        onAdopt={(title, replace) => change(() => adoptFlagshipIdeaAction({ title, replace }))}
      />
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          Your flagships stay until you change them. Research (last{" "}
          {formatDay(refreshedAt) || "recently"}, weekly) only adds new ideas below — nothing is
          lost.
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
        {note ? <span className="text-warning">{note}</span> : null}
      </div>
    </div>
  );
}

/**
 * New ideas from research and earlier ones, kept beside the flagships — so a weekly refresh is
 * an offer, never a loss.
 */
function FlagshipIdeas({
  ideas,
  current,
  busy,
  onAdopt,
}: {
  ideas: FlagshipIdea[];
  current: Flagship[];
  busy: boolean;
  onAdopt: (title: string, replace: string | null) => void;
}) {
  const [open, setOpen] = useState<"new" | "earlier" | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);
  const fresh = ideas.filter((idea) => idea.state === "new");
  const earlier = ideas.filter((idea) => idea.state === "earlier");
  if (ideas.length === 0) return null;
  const full = current.length >= MAX_FLAGSHIPS;
  const shown = open === "new" ? fresh : open === "earlier" ? earlier : [];

  const tab = (which: "new" | "earlier", label: string, count: number) =>
    count > 0 ? (
      <button
        type="button"
        onClick={() => setOpen(open === which ? null : which)}
        className={`rounded-lg border px-3 py-1.5 text-xs ${
          open === which
            ? "border-primary/60 bg-primary/10 text-foreground"
            : "border-border text-muted-foreground hover:text-foreground"
        }`}
      >
        {label} ({count})
      </button>
    ) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tab("new", "New ideas from research", fresh.length)}
        {tab("earlier", "Earlier ideas", earlier.length)}
      </div>
      {shown.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map(({ flagship }) => (
            <article
              key={flagship.title}
              className="rounded-xl border border-border bg-card/60 p-3"
            >
              <h4 className="text-sm font-semibold leading-snug">{flagship.title}</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">{flagship.scope}</p>
              <p className="mt-2 text-xs">{flagship.problem}</p>
              {choosing === flagship.title ? (
                <div className="mt-3 space-y-1.5 text-xs">
                  <p className="text-muted-foreground">Use it in place of:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {current.map((f) => (
                      <button
                        key={f.title}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setChoosing(null);
                          onAdopt(flagship.title, f.title);
                        }}
                        className="rounded-md border border-border px-2 py-1 hover:border-primary/50"
                      >
                        {f.title}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setChoosing(null)}
                      className="px-2 py-1 text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-muted-foreground">
                    The one it replaces stays under Earlier ideas.
                  </p>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 h-7"
                  disabled={busy}
                  onClick={() =>
                    full ? setChoosing(flagship.title) : onAdopt(flagship.title, null)
                  }
                >
                  {full ? "Use instead of one…" : "Add to my flagships"}
                </Button>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
