"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileCheck2,
  ListChecks,
  Loader2,
  Monitor,
  Paperclip,
  RotateCcw,
  Server,
  ShieldQuestion,
} from "lucide-react";

import {
  completeStepAction,
  listProjectRuns,
  reopenStepAction,
  type RunView,
  type StepView,
} from "@/app/dashboard/learning/lab-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function proofLabel(step: StepView) {
  if (step.completion === "verified") {
    return {
      title: "Machine check recorded",
      detail: `${step.verify ? `Recorded check: ${step.verify}. ` : ""}This confirms an output condition, not who performed the work.`,
      className: "text-sky-400",
      icon: FileCheck2,
    };
  }
  if (step.completion === "evidenced") {
    return {
      title: "Artifact attached",
      detail: step.artifact ?? "A result was recorded for this step.",
      className: "text-emerald-400",
      icon: Paperclip,
    };
  }
  return {
    title: "Self-reported · no artifact",
    detail: "This records completion in your own account. It does not count as evidence.",
    className: "text-muted-foreground",
    icon: ShieldQuestion,
  };
}

export function ProjectWorkspace({ runId }: { runId: string }) {
  const [run, setRun] = useState<RunView | null | undefined>(undefined);
  const [artifact, setArtifact] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [panel, setPanel] = useState<"build" | "evidence">("build");
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const result = await listProjectRuns();
      setRun(result.ok ? (result.runs.find((candidate) => candidate.id === runId) ?? null) : null);
    });
  }, [runId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const current = useMemo(() => run?.steps.find((step) => step.status === "pending"), [run]);

  if (run === undefined) {
    return (
      <div className="grid min-h-72 place-items-center rounded-xl border border-border bg-card">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading project…
        </p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <AlertCircle className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-3 font-semibold">Project unavailable</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          It may have been removed, or it does not belong to this account.
        </p>
        <Link
          href="/dashboard/learning/projects"
          className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
        >
          Return to projects
        </Link>
      </div>
    );
  }

  const completeCurrent = () => {
    if (!current) return;
    setMessage(null);
    startTransition(async () => {
      const result = await completeStepAction({
        stepId: current.id,
        artifact: artifact.trim() || null,
      });
      if (!result.ok) {
        setMessage("Fadi could not record this step. Nothing was changed.");
        return;
      }
      setArtifact("");
      refresh();
    });
  };

  const percent = run.steps.length === 0 ? 0 : Math.round((run.doneCount / run.steps.length) * 100);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/12 via-transparent to-[oklch(0.7_0.17_230/0.08)]" />
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-wrap items-start gap-4">
            <Link
              href="/dashboard/learning/projects"
              aria-label="Back to projects"
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-border/70 bg-background/50 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <BookOpen className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-primary">Learning project</p>
              <h1 className="mt-1 font-heading text-2xl font-semibold sm:text-3xl">{run.title}</h1>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <ListChecks className="size-3.5" aria-hidden="true" /> {run.steps.length} guided
                  steps
                </span>
                <span className="flex items-center gap-1.5">
                  <Paperclip className="size-3.5" aria-hidden="true" /> {run.evidencedCount}{" "}
                  artifacts
                </span>
                <span className="flex items-center gap-1.5">
                  <Server className="size-3.5" aria-hidden="true" />
                  {run.resourceLabel ?? "No machine placed"}
                </span>
              </div>
            </div>
            <span className="rounded-full border border-border bg-background/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              {current ? "In progress" : "Completed"}
            </span>
          </div>
        </div>
        <div className="relative border-t border-border/60 bg-background/40 px-5 py-3 sm:px-7">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Project progress</span>
            <span className="font-mono font-semibold tabular-nums">{percent}%</span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-label="Project progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-1 border-b border-border">
        <WorkspaceTab active={panel === "build"} onClick={() => setPanel("build")}>
          <BookOpen className="size-3.5" aria-hidden="true" /> Guided build
        </WorkspaceTab>
        <WorkspaceTab active={panel === "evidence"} onClick={() => setPanel("evidence")}>
          <Paperclip className="size-3.5" aria-hidden="true" /> Evidence ({run.evidencedCount})
        </WorkspaceTab>
      </div>

      {panel === "build" ? (
        <>
          <section className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <div className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
              <Server className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Lab environment</p>
              <p className="text-xs text-muted-foreground">
                {run.resourceLabel
                  ? `${run.resourceLabel} is selected for this project. No runtime session is attached yet.`
                  : "Choose a machine before Fadi prepares a lab for this project."}
              </p>
            </div>
            <Link
              href="/dashboard/learning/machines"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
            >
              Manage machines <ExternalLink className="size-3" aria-hidden="true" />
            </Link>
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(19rem,0.78fr)_minmax(26rem,1.22fr)]">
            <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <header className="border-b border-border/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tasks
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Complete the current task before the next one becomes active.
                </p>
              </header>
              <ol className="divide-y divide-border/60">
                {run.steps.map((step) => {
                  const isCurrent = current?.id === step.id;
                  const isDone = step.status === "done";
                  return (
                    <li key={step.id} className={isCurrent ? "bg-primary/[0.04]" : undefined}>
                      <div className="flex gap-3 p-4">
                        <span
                          className={`grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold ${
                            isDone
                              ? "border-primary/40 bg-primary/15 text-primary"
                              : isCurrent
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground"
                          }`}
                        >
                          {isDone ? (
                            <Check className="size-3.5" aria-hidden="true" />
                          ) : (
                            step.ordinal
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Task {step.ordinal}
                              </p>
                              <h2 className="mt-0.5 text-sm font-semibold">{step.title}</h2>
                            </div>
                            {isDone ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 shrink-0 text-[10px]"
                                disabled={pending}
                                onClick={() =>
                                  startTransition(async () => {
                                    const result = await reopenStepAction({ stepId: step.id });
                                    if (!result.ok) setMessage("Fadi could not reopen this step.");
                                    else refresh();
                                  })
                                }
                              >
                                <RotateCcw className="size-3" aria-hidden="true" /> Reopen
                              </Button>
                            ) : null}
                          </div>

                          {isCurrent ? (
                            <div className="mt-3 space-y-4">
                              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                                {step.instruction}
                              </p>
                              {step.verify ? (
                                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                                  <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                                    <CheckCircle2 className="size-3.5" aria-hidden="true" /> Success
                                    condition
                                  </p>
                                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                    {step.verify}
                                  </p>
                                </div>
                              ) : null}
                              <div>
                                <label htmlFor="step-artifact" className="text-xs font-medium">
                                  What did this task produce?
                                </label>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  {step.produces ??
                                    "Add a path, repository, screenshot reference, command, or output."}
                                </p>
                                <Input
                                  id="step-artifact"
                                  value={artifact}
                                  onChange={(event) => setArtifact(event.target.value)}
                                  placeholder="Paste or describe the result"
                                  className="mt-2 h-9 text-xs"
                                />
                                <p className="mt-1.5 text-[11px] text-muted-foreground">
                                  {artifact.trim()
                                    ? "This result will be attached to the task."
                                    : "Without a result, completion is recorded as self-reported and does not count as evidence."}
                                </p>
                              </div>
                              {message ? (
                                <p className="text-xs text-destructive">{message}</p>
                              ) : null}
                              <Button
                                onClick={completeCurrent}
                                disabled={pending}
                                className="w-full"
                              >
                                {pending ? (
                                  <Loader2 className="animate-spin" aria-hidden="true" />
                                ) : (
                                  <Check aria-hidden="true" />
                                )}
                                {artifact.trim()
                                  ? "Save artifact and continue"
                                  : "Mark self-reported and continue"}
                              </Button>
                            </div>
                          ) : isDone ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {proofLabel(step).title}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">Up next</p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="min-h-[34rem] overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Machine surface
                  </p>
                  <h2 className="mt-1 font-semibold">
                    {run.resourceLabel ?? "No machine selected"}
                  </h2>
                </div>
                <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                  No runtime session
                </span>
              </div>
              <div className="grid min-h-[29rem] place-items-center bg-background/30 p-8 text-center">
                <div className="max-w-md">
                  <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-border bg-card">
                    <Monitor className="size-6 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-semibold">
                    {run.resourceLabel
                      ? "Machine chosen; session not started"
                      : "Choose where this project will run"}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {run.resourceLabel
                      ? "Fadi has placement information, but no durable provisioning state, reachable endpoint, or readiness check for this run. The console stays closed until those facts exist."
                      : "Register or select a machine. The engine will check capacity before asking permission to provision anything."}
                  </p>
                  <Link
                    href="/dashboard/learning/machines"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    Open Machines <ExternalLink className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </>
      ) : (
        <EvidencePanel
          run={run}
          pending={pending}
          refresh={refresh}
          startTransition={startTransition}
        />
      )}
    </div>
  );
}

function WorkspaceTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative inline-flex h-10 items-center gap-1.5 px-3 text-sm font-medium transition-colors ${
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      {active ? <span className="absolute inset-x-2 bottom-[-1px] h-0.5 bg-primary" /> : null}
    </button>
  );
}

function EvidencePanel({
  run,
  pending,
  refresh,
  startTransition,
}: {
  run: RunView;
  pending: boolean;
  refresh: () => void;
  startTransition: React.TransitionStartFunction;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Evidence record
          </p>
          <h2 className="mt-1 font-semibold">What this project can support</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Completion, artifacts, and machine observations remain separate.
        </p>
      </div>
      <ol className="mt-4 divide-y divide-border/60">
        {run.steps.map((step) => {
          const proof = step.status === "done" ? proofLabel(step) : null;
          const ProofIcon = proof?.icon;
          return (
            <li key={step.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
              {step.status === "done" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <Circle
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {step.ordinal}. {step.title}
                </p>
                {proof && ProofIcon ? (
                  <div className="mt-1.5">
                    <p
                      className={`flex items-center gap-1.5 text-xs font-medium ${proof.className}`}
                    >
                      <ProofIcon className="size-3.5" aria-hidden="true" />
                      {proof.title}
                    </p>
                    <p className="mt-0.5 break-words text-xs text-muted-foreground">
                      {proof.detail}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">No completion claim recorded</p>
                )}
              </div>
              {step.status === "done" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 text-xs"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await reopenStepAction({ stepId: step.id });
                      refresh();
                    })
                  }
                >
                  <RotateCcw className="size-3" aria-hidden="true" /> Reopen
                </Button>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
