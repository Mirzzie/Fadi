"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronRight, Hammer, Loader2, Play, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
          {mode === "overview"
            ? "Pick a skill below and turn it into a project."
            : "Projects for this direction appear here once you turn a skill into one."}
        </p>
        {mode === "all" ? (
          <Link
            href="/dashboard/learning"
            className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
          >
            Find a skill gap
          </Link>
        ) : null}
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

/** One project, rendered by the server-built Learning home, which re-reads on a stop. */
export function ProjectCard({ run, featured = false }: { run: RunView; featured?: boolean }) {
  const router = useRouter();
  return <RunCard run={run} onChanged={() => router.refresh()} featured={featured} />;
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
      className={`border-y bg-card p-4 sm:p-5 ${featured ? "border-primary/30" : "border-border"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <h3 className="min-w-0 font-semibold">{run.title}</h3>
        <span className="text-xs text-muted-foreground">
          {run.labLabel ? `${run.labLabel} lab` : "No lab needed"}
        </span>
      </div>
      <p className="mt-1 truncate text-sm text-muted-foreground">
        {next ? `Step ${next.ordinal} of ${run.steps.length}: ${next.title}` : "Completed"}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border/70" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          nativeButton={false}
          render={<Link href={`/dashboard/learning/projects/${run.id}`} />}
        >
          {next ? <Play className="size-3.5" aria-hidden="true" /> : null}
          {next ? "Continue" : "Review"}
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
        {/* A finished project has nothing to stop. */}
        {next ? <StopProject run={run} onChanged={onChanged} /> : null}
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
