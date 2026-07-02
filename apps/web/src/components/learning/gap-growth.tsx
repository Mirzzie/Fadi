"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleCheckBig, Hammer, Loader2, Search, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  commitToProjectAction,
  completeCommitmentAction,
  deleteCommitmentAction,
  suggestForGapAction,
} from "@/app/dashboard/learning/actions";
import type { CommitmentView } from "@/lib/learning/commitments-view";
import type { ProjectSuggestion } from "@/lib/learning/suggest";

/** Gap → the smallest real project that closes it → one-click commitment. */
export function GapGrowth({ gapTitle, gapDetail }: { gapTitle: string; gapDetail?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<ProjectSuggestion[] | null>(null);
  const [committed, setCommitted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function suggest() {
    setError(null);
    startTransition(async () => {
      const res = await suggestForGapAction({ gapTitle, gapDetail });
      if (!res.ok) return setError(res.message);
      setSuggestions(res.suggestions);
    });
  }

  function commit(s: ProjectSuggestion) {
    startTransition(async () => {
      const res = await commitToProjectAction({
        gap: gapTitle,
        title: s.title,
        detail: s.detail,
        kind: s.kind,
        searchQuery: s.searchQuery,
      });
      if (!res.ok) return setError(res.message ?? "Couldn't commit.");
      setCommitted((prev) => new Set(prev).add(s.title));
      router.refresh(); // shows up under "In progress"
    });
  }

  return (
    <div className="mt-2">
      {!suggestions ? (
        <button
          type="button"
          onClick={suggest}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Hammer className="size-3.5" aria-hidden="true" />}
          Turn this gap into a project
        </button>
      ) : (
        <div className="mt-1 space-y-2">
          {suggestions.map((s) => (
            <div key={s.title} className="rounded-md border border-border/60 bg-background/40 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {s.title}{" "}
                    <span className="font-normal text-muted-foreground">· {s.kind}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p>
                </div>
                {committed.has(s.title) ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-400">
                    <Check className="size-3.5" aria-hidden="true" /> Committed
                  </span>
                ) : (
                  <Button size="sm" variant="outline" className="shrink-0" disabled={pending} onClick={() => commit(s)}>
                    Commit
                  </Button>
                )}
              </div>
            </div>
          ))}
          <p className="text-[0.7rem] text-muted-foreground">
            When you finish one, mark it complete below — what you built goes into your Evidence and
            strengthens this direction&apos;s resume automatically.
          </p>
        </div>
      )}
      {error ? <p className="mt-1 text-xs text-amber-400">{error}</p> : null}
    </div>
  );
}

/** In-progress + completed commitments; completing feeds the resume data. */
export function CommitmentsList({ commitments }: { commitments: CommitmentView[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [built, setBuilt] = useState("");
  const [note, setNote] = useState<string | null>(null);

  if (commitments.length === 0) return null;
  const inProgress = commitments.filter((c) => c.status === "committed");
  const done = commitments.filter((c) => c.status === "completed");

  function complete(id: string) {
    startTransition(async () => {
      const res = await completeCommitmentAction({ id, whatIBuilt: built });
      setNote(res.message);
      if (res.ok) {
        setCompletingId(null);
        setBuilt("");
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteCommitmentAction({ id });
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Your commitments
        </h3>
      </div>
      {note ? <p className="rounded-md border border-primary/30 bg-primary/10 p-2 text-sm">{note}</p> : null}
      <div className="space-y-2">
        {inProgress.map((c) => (
          <div key={c.id} className="rounded-xl border border-border/60 bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{c.title}</p>
                <p className="text-xs text-muted-foreground">
                  closes: {c.gap} · {c.kind}
                </p>
                {c.detail ? <p className="mt-1 text-sm text-muted-foreground">{c.detail}</p> : null}
                {c.searchQuery ? (
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(c.searchQuery)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Search className="size-3" aria-hidden="true" /> Find tutorials: “{c.searchQuery}”
                  </a>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  size="sm"
                  variant={completingId === c.id ? "secondary" : "default"}
                  onClick={() => setCompletingId(completingId === c.id ? null : c.id)}
                >
                  <CircleCheckBig className="size-3.5" aria-hidden="true" /> Done?
                </Button>
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  disabled={pending}
                  aria-label="Drop this commitment"
                  title="Drop it — refocusing is a valid move"
                  className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
            {completingId === c.id ? (
              <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                <label className="text-xs font-medium text-muted-foreground" htmlFor={`built-${c.id}`}>
                  What did you actually build or learn? (your words — this goes on the resume)
                </label>
                <textarea
                  id={`built-${c.id}`}
                  value={built}
                  onChange={(e) => setBuilt(e.target.value)}
                  rows={2}
                  placeholder="e.g. Built a home SOC lab with Wazuh + Sysmon; wrote 12 detection rules and triaged simulated incidents."
                  className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/40"
                />
                <Button size="sm" onClick={() => complete(c.id)} disabled={pending}>
                  {pending ? "Saving…" : "Complete → add to my Evidence"}
                </Button>
              </div>
            ) : null}
          </div>
        ))}
        {done.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            <Check className="mr-1 inline size-3 text-emerald-400" aria-hidden="true" />
            Completed: {done.map((c) => c.title).join(" · ")} — now in your Evidence.
          </p>
        ) : null}
      </div>
    </section>
  );
}
