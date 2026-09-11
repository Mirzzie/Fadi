"use client";

import { useEffect, useState, useTransition } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Hammer,
  Loader2,
  Monitor,
  Paperclip,
  Play,
  X,
} from "lucide-react";
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
    return (
      <section className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
        <Hammer className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-3 text-sm font-semibold">
          {mode === "overview" ? "No active project" : "No projects yet"}
        </h2>
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
    <div className={mode === "all" ? "grid gap-4 md:grid-cols-2" : "space-y-3"}>
      {visible.map((run) => (
        <RunCard key={run.id} run={run} onChanged={refresh} featured={mode === "overview"} />
      ))}
    </div>
  );
}

function RunCard({
  run,
  onChanged,
  featured,
}: {
  run: RunView;
  onChanged: () => void;
  featured: boolean;
}) {
  const done = run.steps.filter((s) => s.status === "done").length;
  const next = run.steps.find((s) => s.status === "pending");
  const percent = run.steps.length === 0 ? 0 : Math.round((done / run.steps.length) * 100);

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${featured ? "border-primary/30" : "border-border"}`}
    >
      <div className="relative border-b border-border/60 bg-gradient-to-r from-primary/10 via-transparent to-transparent p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Hammer className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{run.title}</h3>
              <span className="rounded-full border border-border bg-background/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {next ? "In progress" : "Completed"}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3" aria-hidden="true" /> {done}/{run.steps.length}{" "}
                steps
              </span>
              <span className="flex items-center gap-1">
                <Paperclip className="size-3" aria-hidden="true" /> {run.evidencedCount} artifacts
              </span>
              <span className="flex items-center gap-1">
                <Monitor className="size-3" aria-hidden="true" />
                {run.resourceLabel ?? "No machine placed"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Project progress</span>
            <span className="font-mono tabular-nums">{percent}%</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-border/70"
            role="progressbar"
            aria-label="Project progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-background/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            {next ? `Next · step ${next.ordinal}` : "Project record"}
          </p>
          <p className="mt-1 truncate text-sm font-medium">
            {next?.title ?? `${run.evidencedCount} of ${run.steps.length} steps have an artifact`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button render={<Link href={`/dashboard/learning/projects/${run.id}`} />}>
            {next ? <Play className="size-3.5" aria-hidden="true" /> : null}
            {next ? "Continue project" : "Review project"}
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Button>
          <StopProject run={run} onChanged={onChanged} />
        </div>
      </div>
    </article>
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
