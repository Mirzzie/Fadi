"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, ChevronRight, Hammer, Loader2, Target, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  completeStepAction,
  listProjectRuns,
  planProjectAction,
  reopenStepAction,
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
        {/* A way out. A plan you cannot stop following is a plan that turns into guilt —
            and the platform has no business holding someone to a project it suggested. */}
        <StopProject run={run} onChanged={onChanged} />
      </div>

      {/* Progress you can see, without a list you have to face.

          A step you ticked and a step that produced something are drawn differently. A
          solid bar across six empty clicks is the same false claim as the copy underneath
          it, just in a medium that is easier to believe. */}
      <div className="mt-2 flex gap-1" aria-label={`${done} of ${run.steps.length} steps done, ${run.evidencedCount} with something to show`}>
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
          {/* Not called "optional" any more. It is still allowed to be empty — sometimes
              you did the thing and there is genuinely nothing to paste — but the sentence
              now says what an empty one costs, at the moment the choice is made rather
              than at the end when the project claims to be evidence. */}
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {artifact.trim()
              ? "This is what makes the step showable later."
              : "Leave it empty and this step is marked done on your word alone — it won't count as evidence."}
          </p>
        </div>
      ) : (
        /*
          THE HONEST ENDING.

          This used to say "finishing this will fold what you produced into your evidence"
          regardless of whether anything was produced — so six empty clicks ended in a
          promise of achievement. Fadi does not get to describe a memory as a result.
        */
        <div className="mt-3 space-y-1.5">
          {run.evidencedCount === 0 ? (
            <>
              <p className="text-xs text-amber-400">
                All {run.steps.length} steps are ticked, but nothing was recorded against any of
                them — so there is nothing here to show anyone, and none of it becomes evidence.
              </p>
              <p className="text-[11px] text-muted-foreground">
                If you did the work, reopen a step and paste what it produced: a path, a repo, a
                screenshot, a command and its output. If you didn&apos;t, drop the project — that
                is a normal thing to do and it costs you nothing.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {run.steps.map((st) => (
                  <Button
                    key={st.id}
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px]"
                    disabled={saving || pending}
                    onClick={() =>
                      start(async () => {
                        await reopenStepAction({ stepId: st.id });
                        onChanged();
                      })
                    }
                  >
                    Reopen step {st.ordinal}
                  </Button>
                ))}
              </div>
            </>
          ) : run.evidencedCount < run.steps.length ? (
            <p className="text-xs text-emerald-400">
              Every step is done. {run.evidencedCount} of {run.steps.length} left something behind —
              only those become evidence.
            </p>
          ) : (
            <p className="text-xs text-emerald-400">
              Every step is done and every one produced something. All of it can become evidence.
            </p>
          )}
        </div>
      )}
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
        onClick={() => start(async () => { await stopProjectRun({ runId: run.id, mode: "abandon" }); onChanged(); })}
      >
        Drop it, keep the record
      </Button>
      <Button
        size="sm"
        variant="destructive"
        className="h-6 px-2 text-[10px]"
        disabled={busy}
        onClick={() => start(async () => { await stopProjectRun({ runId: run.id, mode: "delete" }); onChanged(); })}
      >
        Delete it entirely
      </Button>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setAsking(false)}>
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
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Hammer className="size-3.5" aria-hidden="true" />}
        {pending ? "Planning against your hardware…" : "Plan the steps"}
      </Button>
      {msg ? <p className="mt-1 text-[11px] text-destructive">{msg}</p> : null}
    </div>
  );
}
