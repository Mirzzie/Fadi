"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronRight, Hammer, Loader2, X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  listProjectRuns,
  planProjectAction,
  stopProjectRun,
  type RunView,
} from "@/app/dashboard/learning/lab-actions";

/**
 * ONE STEP AT A TIME, AGAINST THE MACHINE YOU OWN.
 *
 * The learning section's output was a suggestion and a tutorial link, which offloads
 * every real decision — what to install, on which machine, what "working" looks like,
 * what to keep — onto the person who came here because they did not know.
 *
 * Deliberately shows ONE step. A list of twelve is a course, and a course gets
 * abandoned; the next thing you have to do is the only thing worth putting on screen.
 * The steps behind it stay visible as a count, because progress you cannot see is
 * progress that does not feel like any.
 *
 * Every step asks what it PRODUCED before it counts as done — that answer is what turns
 * a finished project into evidence rather than a memory.
 */
export function ProjectRuns({ mode = "overview" }: { mode?: "overview" | "all" }) {
  const [runs, setRuns] = useState<RunView[] | null>(null);
  const [, start] = useTransition();

  const refresh = () =>
    start(async () => {
      const res = await listProjectRuns();
      if (res.ok) setRuns(res.runs);
    });

  useEffect(() => {
    refresh();
    // Planning happens in a different card; without this the new run would not appear
    // until a reload, which is exactly the kind of staleness the LabFit bug showed.
    const onChanged = () => refresh();
    window.addEventListener("fadi:runs-changed", onChanged);
    return () => window.removeEventListener("fadi:runs-changed", onChanged);
  }, []);

  if (!runs) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" /> loading projects…
      </p>
    );
  }

  const visible = mode === "overview" ? runs.filter((r) => r.status !== "done") : runs;
  if (visible.length === 0) {
    if (mode === "overview") return null;
    return (
      <section className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
        <Hammer className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-3 text-sm font-semibold">No projects yet</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Turn a skill gap into a project from Overview. Fadi will plan one next step at a time and
          ask what each step produced.
        </p>
        <Link
          href="/dashboard/learning"
          className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
        >
          Find a skill gap
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Hammer className="size-3.5" aria-hidden="true" />
        {mode === "overview" ? "Continue your project" : "Your projects"}
      </h2>
      {visible.map((run) => (
        <RunCard key={run.id} run={run} onChanged={refresh} />
      ))}
    </section>
  );
}

function RunCard({ run, onChanged }: { run: RunView; onChanged: () => void }) {
  const done = run.steps.filter((s) => s.status === "done").length;
  const next = run.steps.find((s) => s.status === "pending");

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{run.title}</h3>
        {run.resourceLabel ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
            on {run.resourceLabel}
          </span>
        ) : null}
        <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
          {done}/{run.steps.length}
        </span>
        {/* A way out. A plan you cannot stop following is a plan that turns into guilt —
            and the platform has no business holding someone to a project it suggested. */}
        <StopProject run={run} onChanged={onChanged} />
      </div>

      {/* Progress you can see, without a list you have to face.

          A step you ticked and a step that produced something are drawn differently. A
          solid bar across six empty clicks is the same false claim as the copy underneath
          it, just in a medium that is easier to believe. */}
      <div
        className="mt-2 flex gap-1"
        aria-label={`${done} of ${run.steps.length} steps done, ${run.evidencedCount} with something to show`}
      >
        {run.steps.map((s) => (
          <span
            key={s.id}
            title={
              s.status !== "done"
                ? "Not started"
                : s.completion === "attested"
                  ? "Marked done — nothing recorded"
                  : "Produced: " + (s.artifact ?? "")
            }
            className={`h-1 flex-1 rounded-full ${
              s.status !== "done"
                ? "bg-border"
                : s.completion === "attested"
                  ? "bg-primary/30"
                  : "bg-primary"
            }`}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {next ? `Next · step ${next.ordinal}` : "Project complete"}
          </p>
          <p className="truncate text-sm font-medium">
            {next?.title ?? `${run.evidencedCount} of ${run.steps.length} steps have an artifact`}
          </p>
        </div>
        <Link
          href={`/dashboard/learning/projects/${run.id}`}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {next ? "Continue" : "Review"}
          <ChevronRight className="size-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

/**
 * Stopping a project, with the two verbs kept apart.
 *
 * "Drop it" keeps the plan and marks it abandoned — how "I tried this and it wasn't for
 * me" stays visible instead of becoming an unexplained gap. "Delete" removes it, for a
 * plan generated by mistake, because refusing that is the platform deciding it knows
 * better than the person whose account it is.
 */
function StopProject({ run, onChanged }: { run: RunView; onChanged: () => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, start] = useTransition();

  if (!asking) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-[10px] text-muted-foreground"
        onClick={() => setAsking(true)}
      >
        <X className="size-3" aria-hidden="true" />
        Stop
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-1.5 pt-1">
      <span className="text-[11px] text-muted-foreground">Stop &ldquo;{run.title}&rdquo;?</span>
      <Button
        size="sm"
        variant="outline"
        className="h-6 px-2 text-[10px]"
        disabled={busy}
        onClick={() =>
          start(async () => {
            await stopProjectRun({ runId: run.id, mode: "abandon" });
            onChanged();
          })
        }
      >
        Drop it, keep the record
      </Button>
      <Button
        size="sm"
        variant="destructive"
        className="h-6 px-2 text-[10px]"
        disabled={busy}
        onClick={() =>
          start(async () => {
            await stopProjectRun({ runId: run.id, mode: "delete" });
            onChanged();
          })
        }
      >
        Delete it entirely
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-[10px]"
        onClick={() => setAsking(false)}
      >
        Cancel
      </Button>
    </div>
  );
}

/** Plan a project into steps — the action behind "Turn this gap into a project". */
export function PlanProjectButton({
  title,
  detail,
  onPlanned,
}: {
  title: string;
  detail?: string | null;
  onPlanned?: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const res = await planProjectAction({ title, detail });
            if (!res.ok) return setMsg(res.message ?? "Couldn't plan this one.");
            onPlanned?.();
            // A full reload would lose the page position; the run list re-reads itself.
            window.dispatchEvent(new CustomEvent("fadi:runs-changed"));
          })
        }
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Hammer className="size-3.5" aria-hidden="true" />
        )}
        {pending ? "Planning against your hardware…" : "Plan the steps"}
      </Button>
      {msg ? <p className="mt-1 text-[11px] text-destructive">{msg}</p> : null}
    </div>
  );
}
