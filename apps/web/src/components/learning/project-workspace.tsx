"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileCheck2,
  Loader2,
  Monitor,
  Paperclip,
  RotateCcw,
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

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start gap-3">
        <Link
          href="/dashboard/learning/projects"
          aria-label="Back to projects"
          className="mt-0.5 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Project workspace
          </p>
          <h1 className="truncate font-heading text-xl font-semibold">{run.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {run.doneCount} of {run.steps.length} steps complete · {run.evidencedCount} with an
            artifact
          </p>
        </div>
        <Link
          href="/dashboard/learning/machines"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
        >
          <Monitor className="size-3.5" aria-hidden="true" />
          Machines
        </Link>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(18rem,0.78fr)_minmax(24rem,1.22fr)]">
        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {current ? `Step ${current.ordinal} of ${run.steps.length}` : "Project complete"}
            </p>
            <h2 className="mt-2 text-lg font-semibold">
              {current?.title ?? "Review what you produced"}
            </h2>
            {current ? (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {current.instruction}
              </p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Every step is marked complete. The record below distinguishes attached artifacts
                from completion recorded only on your word.
              </p>
            )}
          </div>

          {current ? (
            <div className="space-y-4 p-5">
              {current.verify ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    Success condition
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{current.verify}</p>
                </div>
              ) : null}

              <div>
                <label htmlFor="step-artifact" className="text-sm font-medium">
                  What did this step produce?
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {current.produces ??
                    "Add a file path, repository, screenshot reference, command, or output."}
                </p>
                <Input
                  id="step-artifact"
                  value={artifact}
                  onChange={(event) => setArtifact(event.target.value)}
                  placeholder="Paste or describe the result"
                  className="mt-2"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {artifact.trim()
                    ? "This will be kept as the artifact for this step."
                    : "You can continue without one, but the step will be labelled self-reported and will not count as evidence."}
                </p>
              </div>

              {message ? <p className="text-xs text-destructive">{message}</p> : null}
              <Button onClick={completeCurrent} disabled={pending} className="w-full sm:w-auto">
                {pending ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Check aria-hidden="true" />
                )}
                {artifact.trim() ? "Save artifact and continue" : "Mark self-reported and continue"}
              </Button>
            </div>
          ) : null}
        </section>

        <section className="min-h-[26rem] overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lab session
              </p>
              <h2 className="mt-1 font-semibold">{run.resourceLabel ?? "No machine selected"}</h2>
            </div>
            <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
              No live session
            </span>
          </div>
          <div className="grid min-h-80 place-items-center p-6 text-center">
            <div className="max-w-md">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted">
                <Monitor className="size-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-semibold">
                {run.resourceLabel
                  ? "Placement recorded; runtime not attached"
                  : "Choose where this project will run"}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {run.resourceLabel
                  ? `${run.resourceLabel} is the planned host. Fadi has no durable runtime or readiness signal linked to this project yet, so it cannot truthfully show a console or call the lab ready.`
                  : "Register a machine before starting a lab session. Fadi will distinguish machine capacity, endpoint reachability, and operating-system readiness."}
              </p>
              <Link
                href="/dashboard/learning/machines"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Open Machines
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Project record
            </p>
            <h2 className="mt-1 font-semibold">Steps and evidence</h2>
          </div>
          <p className="text-xs text-muted-foreground">Claims describe what Fadi actually has.</p>
        </div>
        <ol className="mt-4 divide-y divide-border/60">
          {run.steps.map((step) => {
            const proof = step.status === "done" ? proofLabel(step) : null;
            const ProofIcon = proof?.icon;
            return (
              <li key={step.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                {step.status === "done" ? (
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
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
                    <p className="mt-1 text-xs text-muted-foreground">Not completed</p>
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
                        const result = await reopenStepAction({ stepId: step.id });
                        if (!result.ok) setMessage("Fadi could not reopen this step.");
                        else refresh();
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
    </div>
  );
}
