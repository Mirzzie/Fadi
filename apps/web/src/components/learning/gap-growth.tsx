"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleCheckBig,
  Hammer,
  Loader2,
  MonitorPlay,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  commitToProjectAction,
  completeCommitmentAction,
  deleteCommitmentAction,
  suggestForGapAction,
} from "@/app/dashboard/learning/actions";
import { recordFinishStateAction } from "@/app/dashboard/learning/project-finish-actions";
import { CompletionPackage } from "@/components/learning/finish-review";
import type { CommitmentView } from "@/lib/learning/commitments-view";
import type { ProjectSuggestion } from "@/lib/learning/suggest";
import { labNeedFor, worthARepo } from "@/lib/learning/needs-lab";

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
      // One intention, one destination. Committing to a build used to leave you on the
      // list, with the project only appearing if you then found a second button. If Fadi
      // managed to plan it, go there.
      if (res.runId) {
        router.push(`/dashboard/learning/projects/${res.runId}`);
        return;
      }
      router.refresh();
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
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Hammer className="size-3.5" aria-hidden="true" />
          )}
          Turn this gap into a project
        </button>
      ) : (
        <div className="mt-1 space-y-2">
          {/*
            ONE CARD, ONE DECISION.

            This used to carry the whole provisioning apparatus per suggestion — "where you
            could run this", a fits/misses list, two buttons for registering hardware, and a
            plan button — repeated for every item, before the person had committed to
            anything. Ten suggestions meant ten copies of it and a column you could not
            read.

            Fadi already knows whether a thing needs a machine. That knowledge is now USED
            instead of displayed: at most one short phrase on the card, and the machinery
            appears after you commit, for the items that actually need it.
          */}
          {suggestions.map((s) => {
            const need = labNeedFor(s);
            return (
              <div
                key={s.title}
                className="rounded-lg border border-border/60 bg-background/40 p-3 transition-colors hover:border-border"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{s.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.7rem]">
                      <span className="rounded border border-border/60 px-1.5 py-0.5 uppercase tracking-wide text-muted-foreground">
                        {s.kind}
                      </span>
                      {need.needed ? (
                        <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-primary">
                          {need.phrase}
                        </span>
                      ) : null}
                      {worthARepo(s) ? (
                        <span className="text-muted-foreground">· gets a repo</span>
                      ) : null}
                    </div>
                  </div>
                  {committed.has(s.title) ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-400">
                      <Check className="size-3.5" aria-hidden="true" /> Committed
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      className="shrink-0"
                      disabled={pending}
                      onClick={() => commit(s)}
                    >
                      Commit
                    </Button>
                  )}
                </div>
                {/* Two lines of description. The full text lives in the project once
                    committed, where there is room for it. */}
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {s.detail}
                </p>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Committing opens the project. Fadi sets up a machine there only if the build needs one.
          </p>
        </div>
      )}
      {error ? <p className="mt-1 text-xs text-amber-400">{error}</p> : null}
    </div>
  );
}

/**
 * Tutorials for a commitment, on YouTube itself.
 *
 * This used to embed YouTube's search-playlist player in the page. YouTube retired that embed:
 * every commitment showed "This video is unavailable" under a working-looking frame. A plain
 * link to the same search is the honest version — it always works and opens where the person
 * can actually watch.
 */
function TutorialLink({ query }: { query: string }) {
  return (
    <a
      href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`}
      target="_blank"
      rel="noreferrer"
      className="mt-2 inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs font-medium text-primary transition-colors hover:border-primary/40"
    >
      <MonitorPlay className="size-3.5" aria-hidden="true" />
      Tutorials on YouTube: &ldquo;{query}&rdquo;
    </a>
  );
}

/**
 * Open commitments, each finished through the same review as a project: one question — is
 * this an accurate record? — then the same package (portfolio, story, post). A commitment
 * with a project behind it is sent to that project instead (completeCommitmentAction).
 */
export function CommitmentsList({
  commitments,
  heading = "Your commitments",
}: {
  commitments: CommitmentView[];
  /** Null when the surrounding section already names what this is. */
  heading?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [built, setBuilt] = useState("");
  const [note, setNote] = useState<string | null>(null);
  // Kept here, not derived from props: saving revalidates the page, and the finished
  // commitment leaves the list the server sends back — its package must not leave with it.
  const [finished, setFinished] = useState<{
    commitment: CommitmentView;
    recordStatus: "saved" | "needs-review";
    onPortfolio: boolean;
  } | null>(null);

  if (commitments.length === 0 && !finished) return null;
  const inProgress = commitments.filter((c) => c.status === "committed");
  const done = commitments.filter((c) => c.status === "completed");

  function complete(commitment: CommitmentView) {
    const id = commitment.id;
    startTransition(async () => {
      const res = await completeCommitmentAction({ id, whatIBuilt: built });
      if (res.runId) {
        router.push(`/dashboard/learning/projects/${res.runId}`);
        return;
      }
      if (!res.ok) return setNote(res.message);
      setNote(null);
      setCompletingId(null);
      setBuilt("");
      const state = await recordFinishStateAction({ commitmentId: id });
      if (state.ok)
        setFinished({
          commitment,
          recordStatus: state.recordStatus,
          onPortfolio: state.onPortfolio,
        });
      else router.refresh();
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
      {heading ? (
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {heading}
          </h3>
        </div>
      ) : null}
      {note ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">{note}</p>
      ) : null}
      <div className="space-y-2">
        {finished ? (
          <CompletionPackage
            source={{ commitmentId: finished.commitment.id }}
            recordStatus={finished.recordStatus}
            onPortfolio={finished.onPortfolio}
            eyebrow={`${finished.commitment.kind === "certification" ? "Certification" : "Course"} complete: ${finished.commitment.title}`}
          />
        ) : null}
        {inProgress
          .filter((c) => c.id !== finished?.commitment.id)
          .map((c) => (
            <div key={c.id} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    closes: {c.gap} · {c.kind}
                  </p>
                  {c.detail ? (
                    <p className="mt-1 text-sm text-muted-foreground">{c.detail}</p>
                  ) : null}
                  {c.searchQuery ? <TutorialLink query={c.searchQuery} /> : null}
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
                  <p className="text-sm font-semibold">
                    Is this an accurate record of what you completed?
                  </p>
                  <label className="block text-xs text-muted-foreground" htmlFor={`built-${c.id}`}>
                    In your words: what you finished, and anything you built or can now do. This
                    becomes your career record, so only what is true.
                  </label>
                  <textarea
                    id={`built-${c.id}`}
                    value={built}
                    onChange={(e) => setBuilt(e.target.value)}
                    rows={3}
                    placeholder="e.g. Passed CompTIA Security+ (SY0-701) in September 2026; practised firewall rules and log review in the exam labs."
                    className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/40"
                  />
                  <Button
                    size="sm"
                    onClick={() => complete(c)}
                    disabled={pending || built.trim().length < 20}
                  >
                    {pending ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Check className="size-3.5" aria-hidden="true" />
                    )}
                    Yes, save it to my record
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        {done.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            <Check className="mr-1 inline size-3 text-emerald-400" aria-hidden="true" />
            Completed: {done.map((c) => c.title).join(" · ")}. On your career record.
          </p>
        ) : null}
      </div>
    </section>
  );
}
