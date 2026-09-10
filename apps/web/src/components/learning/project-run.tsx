"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, ChevronRight, Hammer, Loader2, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  completeStepAction,
  listProjectRuns,
  planProjectAction,
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
export function ProjectRuns() {
  const [runs, setRuns] = useState<RunView[] | null>(null);
  const [pending, start] = useTransition();

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

  if (!runs || runs.length === 0) return null;
  const active = runs.filter((r) => r.status !== "done");
  if (active.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Hammer className="size-3.5" aria-hidden="true" />
        In progress
      </h2>
      {active.map((run) => (
        <RunCard key={run.id} run={run} onChanged={refresh} pending={pending} />
      ))}
    </section>
  );
}

function RunCard({ run, onChanged, pending }: { run: RunView; onChanged: () => void; pending: boolean }) {
  const [artifact, setArtifact] = useState("");
  const [saving, start] = useTransition();

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
      </div>

      {/* Progress you can see, without a list you have to face. */}
      <div className="mt-2 flex gap-1" aria-label={`${done} of ${run.steps.length} steps done`}>
        {run.steps.map((s) => (
          <span
            key={s.id}
            className={`h-1 flex-1 rounded-full ${s.status === "done" ? "bg-primary" : "bg-border"}`}
          />
        ))}
      </div>

      {next ? (
        <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <ChevronRight className="size-3.5" aria-hidden="true" />
            Step {next.ordinal}
          </p>
          <p className="mt-1 text-sm font-medium">{next.title}</p>
          <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{next.instruction}</p>

          {next.verify ? (
            <p className="mt-2 flex items-start gap-1.5 text-xs">
              <Target className="mt-0.5 size-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
              <span>
                <span className="text-emerald-400">It worked when:</span>{" "}
                <span className="text-muted-foreground">{next.verify}</span>
              </span>
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              value={artifact}
              onChange={(e) => setArtifact(e.target.value)}
              placeholder={next.produces ? `What you produced — ${next.produces}` : "What did this leave behind?"}
              className="h-8 max-w-md text-xs"
            />
            <Button
              size="sm"
              disabled={saving || pending}
              onClick={() =>
                start(async () => {
                  await completeStepAction({ stepId: next.id, artifact: artifact.trim() || null });
                  setArtifact("");
                  onChanged();
                })
              }
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
              Done
            </Button>
          </div>
          {/* Recording the artefact is what makes this evidence later, so it is asked
              for every time rather than at the end when nobody remembers. */}
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Optional, but this is what turns the finished project into something you can show.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-emerald-400">
          Every step is done. Finishing this will fold what you produced into your evidence.
        </p>
      )}
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
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Hammer className="size-3.5" aria-hidden="true" />}
        {pending ? "Planning against your hardware…" : "Plan the steps"}
      </Button>
      {msg ? <p className="mt-1 text-[11px] text-destructive">{msg}</p> : null}
    </div>
  );
}
