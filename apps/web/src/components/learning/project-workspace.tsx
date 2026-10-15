"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, Check, ExternalLink, LifeBuoy, Loader2, RotateCcw } from "lucide-react";

import {
  completeStepAction,
  getProjectRunAction,
  projectRuntimeAction,
  proposeProjectLabAction,
  proposeProjectLabResumeAction,
  proposeProjectLabStopAction,
  proposeSaveBaseAction,
  reopenStepAction,
  labResetAvailabilityAction,
  proposeLabResetAction,
  replanProjectAction,
  resetProjectAction,
  runOnThisComputerAction,
  type ProjectRuntimeView,
  type RunView,
  type StepView,
} from "@/app/dashboard/learning/lab-actions";
import {
  helpWithStepAction,
  acceptRevisedStepAction,
  proposeStepCheckAction,
  type StepHelp,
} from "@/app/dashboard/learning/step-help-actions";
import { FinishReview } from "@/components/learning/finish-review";
import { CommandBlock, StepText } from "@/components/learning/step-text";
import { PendingAction } from "@/components/os/pending-action-card";
import { announceActionsChanged, usePendingActions } from "@/components/os/pending-actions";
import { Button } from "@/components/ui/button";
import { reachableSurface, runtimeMessage } from "@/lib/lab/runtime-contract";
import { ChecksSetup } from "@/components/learning/checks-setup";
import { LabScreenFrame } from "@/components/learning/lab-screen-frame";
import { MachineChooser } from "@/components/learning/machine-chooser";
import { MachineSettings } from "@/components/learning/machine-settings";
import { PlanHistory } from "@/components/learning/plan-history";
import { ProjectBrief } from "@/components/learning/project-brief";
import { ProjectReadiness } from "@/components/learning/project-readiness";
import { ProjectServices } from "@/components/learning/project-services";

/**
 * ONE PROJECT: the step you are on, and the machine you do it on. Nothing else earns a place.
 *
 * The previous version had a hero, a meta row, tabs, an evidence panel repeating the task
 * list, a lab banner repeating the machine pane, and a sentence under every control. Reported
 * as "a lot of things to see, but nothing to see". Completion kinds are still recorded
 * separately; they are shown as a word on the finished step, not a paragraph.
 */
export function ProjectWorkspace({ runId }: { runId: string }) {
  const [run, setRun] = useState<RunView | null | undefined>(undefined);
  const [runtime, setRuntime] = useState<ProjectRuntimeView | undefined>(undefined);
  const [artifact, setArtifact] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [labMessage, setLabMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [pending, startTransition] = useTransition();
  const { pending: approvals, refresh: refreshApprovals } = usePendingActions();

  // Background refresh is a plain async call, never inside startTransition: otherwise every
  // poll flips `pending` and every button flashes ("buttons refresh for no reason").
  const refresh = useCallback(async () => {
    const [result, observed] = await Promise.all([
      getProjectRunAction({ runId }),
      projectRuntimeAction({ runId }),
    ]);
    setRun(result.ok ? result.run : null);
    setRuntime(observed.ok ? observed.runtime : null);
    setTick((value) => value + 1);
  }, [runId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 8_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const current = useMemo(() => run?.steps.find((step) => step.status === "pending"), [run]);
  const approval = approvals.find((request) => request.runId === runId) ?? null;

  if (run === undefined) {
    return (
      <p className="flex min-h-72 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading…
      </p>
    );
  }

  if (!run) {
    return (
      <div className="py-16 text-center">
        <p className="font-semibold">This project isn&apos;t available.</p>
        <Link
          href="/dashboard/learning/projects"
          className="mt-2 inline-block text-sm text-primary hover:underline"
        >
          Back to projects
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
      if (!result.ok) return setMessage("Couldn't save that. Nothing changed.");
      setArtifact("");
      await refresh();
    });
  };

  const proposeLab = (mode: "prepare" | "stop" | "resume" | "restart") => {
    setLabMessage(null);
    startTransition(async () => {
      let result =
        mode === "stop"
          ? await proposeProjectLabStopAction({ runId })
          : mode === "prepare"
            ? await proposeProjectLabAction({ runId })
            : await proposeProjectLabResumeAction({ runId });
      // A lab that failed before its container existed has nothing to start: create it.
      if (mode === "restart" && !result.ok) result = await proposeProjectLabAction({ runId });
      if (!result.ok) setLabMessage(result.message ?? "That didn't work.");
      else {
        announceActionsChanged();
        refreshApprovals();
      }
      await refresh();
    });
  };

  const total = run.steps.length;
  const percent = total === 0 ? 0 : Math.round((run.doneCount / total) * 100);
  const hasLab = Boolean(run.labTemplate);

  return (
    <div className="space-y-4 pb-28">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/learning/projects"
          aria-label="Back to projects"
          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        <h1 className="min-w-0 flex-1 font-heading text-xl font-semibold sm:text-2xl">
          {run.title}
        </h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {current ? `Step ${current.ordinal} of ${total}` : "All steps done"}
          </span>
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-border" aria-hidden="true">
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </header>

      <div
        className={
          hasLab
            ? "grid items-start gap-4 lg:grid-cols-[minmax(24rem,5fr)_minmax(28rem,7fr)]"
            : "mx-auto max-w-3xl space-y-4"
        }
      >
        <div className="space-y-4">
          <ProjectBrief
            detail={run.detail}
            runsOn={
              hasLab
                ? run.target.kind === "local-docker"
                  ? `${run.labLabel ?? "a lab"} on this computer`
                  : run.target.label
                : null
            }
          />
          {current ? (
            <CurrentStep
              key={current.id}
              runId={runId}
              step={current}
              artifact={artifact}
              setArtifact={setArtifact}
              pending={pending}
              message={message}
              onComplete={completeCurrent}
              onRevised={refresh}
              canCheck={Boolean(
                // Linux labs check through docker exec; Windows labs over SSH (labSignIn); the
                // person's own VMware machine over SSH once checks are set up (the action says so
                // when they are not).
                (run.target.kind === "vmware" ||
                  ((run.labShell || run.labSignIn) && run.target.kind === "local-docker")) &&
                runtime &&
                !["stopped", "failed", "queued", "stopping"].includes(runtime.phase)
              )}
              onCheckProposed={() => {
                announceActionsChanged();
                refreshApprovals();
              }}
            />
          ) : (
            <FinishReview runId={runId} stepsKey={run.steps.map((s) => s.status).join()} />
          )}

          <StepList
            steps={run.steps}
            currentId={current?.id ?? null}
            pending={pending}
            onReopen={(stepId) =>
              startTransition(async () => {
                await reopenStepAction({ stepId });
                await refresh();
              })
            }
          />
          <Replan runId={runId} onReplanned={refresh} />
          <PlanHistory
            runId={runId}
            stepsKey={run.steps.map((s) => `${s.id}:${s.status}`).join()}
            onRestored={async (text) => {
              setMessage(text);
              await refresh();
            }}
          />
        </div>

        {hasLab ? (
          <section className="overflow-hidden rounded-2xl border border-border bg-card lg:sticky lg:top-4">
            <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3">
              <span
                className={`size-2 rounded-full ${
                  runtime?.phase === "ready"
                    ? "bg-emerald-500"
                    : runtime && !["failed", "stopped"].includes(runtime.phase)
                      ? "animate-pulse bg-amber-500"
                      : runtime?.phase === "failed"
                        ? "bg-destructive"
                        : "bg-muted-foreground/40"
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {run.labLabel}{" "}
                  <span className="font-normal text-muted-foreground">
                    ·{" "}
                    {run.target.kind === "local-docker"
                      ? "on this computer"
                      : `on ${run.target.label}`}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {run.target.kind === "unconnected"
                    ? `Fadi can't reach ${run.target.label} yet. Connect it in Machines, or run here.`
                    : runtime
                      ? runtimeMessage(runtime)
                      : "Not started"}
                </p>
                {run.labSignIn ? (
                  <p className="text-xs text-muted-foreground">
                    Sign in as{" "}
                    <code className="rounded bg-muted px-1 text-foreground">
                      {run.labSignIn.user}
                    </code>{" "}
                    · password{" "}
                    <code className="rounded bg-muted px-1 text-foreground">
                      {run.labSignIn.password}
                    </code>{" "}
                    (a local administrator; lab only)
                  </p>
                ) : null}
                {run.labSignIn && runtime?.phase === "stopped" ? (
                  <SaveBaseLink runId={runId} />
                ) : null}
              </div>
              {run.target.kind === "unconnected" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await runOnThisComputerAction({ runId });
                      setLabMessage(result.message ?? null);
                      await refresh();
                    })
                  }
                >
                  Run on this computer instead
                </Button>
              ) : !runtime ? (
                <Button
                  size="sm"
                  disabled={pending || Boolean(approval)}
                  onClick={() => proposeLab("prepare")}
                >
                  Start lab
                </Button>
              ) : runtime.phase === "stopped" ? (
                <Button
                  size="sm"
                  disabled={pending || Boolean(approval)}
                  onClick={() => proposeLab("resume")}
                >
                  Resume
                </Button>
              ) : runtime.phase === "failed" ? (
                <Button
                  size="sm"
                  disabled={pending || Boolean(approval)}
                  onClick={() => proposeLab("restart")}
                >
                  Start again
                </Button>
              ) : runtime.phase !== "queued" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending || Boolean(approval)}
                  onClick={() => proposeLab("stop")}
                >
                  Pause
                </Button>
              ) : null}
            </div>

            {!approval && (!runtime || ["stopped", "failed"].includes(runtime.phase)) ? (
              <MachineChooser
                runId={runId}
                onkind={run.target.kind}
                onChanged={(text) => {
                  setLabMessage(text);
                  void refresh();
                }}
              />
            ) : null}
            <MachineSettings
              runId={runId}
              tick={tick}
              onProposed={(text) => {
                setLabMessage(text);
                announceActionsChanged();
                refreshApprovals();
              }}
            />
            <ChecksSetup runId={runId} tick={tick} />
            <ProjectReadiness
              runId={runId}
              tick={tick}
              onProposed={(text) => {
                setLabMessage(text);
                announceActionsChanged();
                refreshApprovals();
              }}
            />
            <ProjectServices
              runId={runId}
              tick={tick}
              onProposed={(text) => {
                setLabMessage(text);
                announceActionsChanged();
                refreshApprovals();
              }}
            />
            {labMessage ? (
              <p className="border-b border-border/70 px-4 py-2 text-xs text-muted-foreground">
                {labMessage}
              </p>
            ) : null}
            {approval ? (
              <div className="p-4">
                <PendingAction
                  w={approval}
                  onSettled={(result) => {
                    setLabMessage(result);
                    refreshApprovals();
                    void refresh();
                  }}
                />
              </div>
            ) : runtime && run.labShell && runtime.phase !== "stopped" ? (
              <div className="border-b border-border/70 p-4">
                <p className="mb-2 text-xs text-muted-foreground">
                  Open a terminal on your computer and run:
                </p>
                <CommandBlock code={run.labShell} lang="terminal" />
              </div>
            ) : null}

            <LabSurface runtime={runtime} labLabel={run.labLabel} hasApproval={Boolean(approval)} />
          </section>
        ) : null}
      </div>
    </div>
  );
}

function LabSurface({
  runtime,
  labLabel,
  hasApproval,
}: {
  runtime: ProjectRuntimeView | undefined;
  labLabel: string | null;
  hasApproval: boolean;
}) {
  if (hasApproval) return null;
  const surface = runtime ? reachableSurface(runtime) : null;
  if (surface?.sessionPath?.startsWith("/lab-screen.html")) {
    return (
      <LabScreenFrame src={surface.sessionPath} title={`${labLabel ?? "Lab"} ${surface.kind}`} />
    );
  }
  if (surface?.sessionPath) {
    return (
      <div className="relative bg-black">
        <iframe
          src={surface.sessionPath}
          title={`${labLabel ?? "Lab"} ${surface.kind}`}
          className="h-[calc(100vh-22rem)] min-h-96 w-full border-0 bg-white"
          allow="clipboard-read; clipboard-write; fullscreen"
          sandbox="allow-forms allow-pointer-lock allow-same-origin allow-scripts"
        />
        <a
          href={surface.sessionPath}
          target="_blank"
          rel="noreferrer"
          className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-xs text-white hover:bg-black"
        >
          <ExternalLink className="size-3" aria-hidden="true" /> Open
        </a>
      </div>
    );
  }
  // Stopped, failed or ready-without-a-viewer: the header already says it. Repeating the same
  // sentence in a large empty box below was noise.
  if (!runtime || ["stopped", "failed", "ready"].includes(runtime.phase)) return null;
  return (
    <p className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
      {!["failed", "stopped", "ready"].includes(runtime.phase) ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : null}
      {runtimeMessage(runtime)}
    </p>
  );
}

function CurrentStep({
  runId,
  step,
  artifact,
  setArtifact,
  pending,
  message,
  onComplete,
  onRevised,
  canCheck,
  onCheckProposed,
}: {
  runId: string;
  step: StepView;
  artifact: string;
  setArtifact: (value: string) => void;
  pending: boolean;
  message: string | null;
  onComplete: () => void;
  onRevised: () => Promise<void>;
  canCheck: boolean;
  onCheckProposed: () => void;
}) {
  const [stuck, setStuck] = useState(false);
  const [checkNote, setCheckNote] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();

  return (
    <section className="rounded-2xl border border-primary/30 bg-card p-5">
      <p className="text-xs font-medium text-primary">Step {step.ordinal}</p>
      <h2 className="mt-0.5 text-lg font-semibold">{step.title}</h2>

      <StepText
        text={step.instruction}
        className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground"
      />

      {step.verify ? (
        <div className="mt-4 rounded-lg bg-emerald-500/5 px-3 py-2.5 ring-1 ring-emerald-500/25">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Done when</p>
          <StepText text={step.verify} className="mt-1 space-y-2 text-sm text-muted-foreground" />
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={artifact}
          onChange={(event) => setArtifact(event.target.value)}
          placeholder={
            step.produces
              ? `Result (optional): ${step.produces}`
              : "Result (optional): a path, output or link"
          }
          aria-label="Result of this step"
          className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm"
        />
        <Button onClick={onComplete} disabled={pending}>
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Check aria-hidden="true" />
          )}
          Done, next step
        </Button>
        {canCheck ? (
          <Button
            variant="outline"
            disabled={checking || pending}
            onClick={() =>
              startCheck(async () => {
                setCheckNote(null);
                const result = await proposeStepCheckAction({ runId, stepId: step.id });
                setCheckNote(result.message);
                if (result.ok) onCheckProposed();
              })
            }
          >
            {checking ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Check it for me
          </Button>
        ) : null}
      </div>
      {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
      {checkNote ? <p className="mt-2 text-xs text-muted-foreground">{checkNote}</p> : null}

      {stuck ? (
        <StuckPanel
          runId={runId}
          step={step}
          onClose={() => setStuck(false)}
          onRevised={onRevised}
        />
      ) : (
        <button
          type="button"
          onClick={() => setStuck(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <LifeBuoy className="size-4" aria-hidden="true" /> Stuck? Show Fadi the error
        </button>
      )}
    </section>
  );
}

/**
 * Paste what the terminal printed; get what went wrong and a fix that fits this lab. Text,
 * not screenshots — see step-help-actions.ts.
 */
function StuckPanel({
  runId,
  step,
  onClose,
  onRevised,
}: {
  runId: string;
  step: StepView;
  onClose: () => void;
  onRevised: () => Promise<void>;
}) {
  const [output, setOutput] = useState("");
  const [help, setHelp] = useState<StepHelp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const ask = () =>
    start(async () => {
      setError(null);
      const result = await helpWithStepAction({ runId, stepId: step.id, output });
      if (result.ok) setHelp(result.help);
      else setError(result.message);
    });

  const accept = () =>
    start(async () => {
      if (!help) return;
      const result = await acceptRevisedStepAction({
        stepId: step.id,
        instruction: help.revisedInstruction,
        verify: help.revisedVerify,
      });
      if (!result.ok) return setError("Couldn't update the step.");
      await onRevised();
      onClose();
    });

  return (
    <div className="mt-4 space-y-3 border-t border-border/70 pt-4">
      {!help ? (
        <>
          <textarea
            value={output}
            onChange={(event) => setOutput(event.target.value)}
            rows={6}
            spellCheck={false}
            placeholder="Paste what your terminal printed (select the text in the terminal and copy it)"
            className="w-full rounded-md border border-border bg-zinc-950 p-3 font-mono text-xs text-zinc-100 placeholder:text-zinc-500"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={busy || !output.trim()} onClick={ask}>
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {busy ? "Reading it…" : "Find the problem"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">{help.whatHappened}</p>
          <StepText
            text={help.fix}
            className="space-y-3 text-sm leading-relaxed text-muted-foreground"
          />
          <div className="flex flex-wrap items-center gap-2">
            {help.stepWasWrong && help.revisedInstruction ? (
              <Button size="sm" disabled={busy} onClick={accept}>
                Fix this step
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setHelp(null)}>
              Paste more output
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function StepList({
  steps,
  currentId,
  pending,
  onReopen,
}: {
  steps: StepView[];
  currentId: string | null;
  pending: boolean;
  onReopen: (stepId: string) => void;
}) {
  return (
    <ol className="rounded-2xl border border-border bg-card py-1">
      {steps.map((step) => {
        const done = step.status === "done";
        const isCurrent = step.id === currentId;
        return (
          <li key={step.id} className="group flex items-center gap-3 px-4 py-2 text-sm">
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium ${
                done
                  ? "bg-primary/15 text-primary"
                  : isCurrent
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground"
              }`}
            >
              {done ? <Check className="size-3.5" aria-hidden="true" /> : step.ordinal}
            </span>
            <span
              className={`min-w-0 flex-1 truncate ${isCurrent ? "font-medium" : done ? "text-muted-foreground" : ""}`}
            >
              {step.title}
            </span>
            {done ? (
              <>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {step.completion === "verified"
                    ? "checked"
                    : step.artifact
                      ? "result saved"
                      : "no result"}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onReopen(step.id)}
                  aria-label={`Reopen step ${step.ordinal}`}
                  className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                </button>
              </>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Behind a confirmation: unfinished steps are replaced; finished steps and their results are kept. */
function Replan({ runId, onReplanned }: { runId: string; onReplanned: () => Promise<void> }) {
  const [asking, setAsking] = useState<null | "replan" | "reset">(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  // Starting over can also give the lab a clean disk from the saved base — no download.
  const [labReset, setLabReset] = useState<{ available: boolean; reason: string | null } | null>(
    null
  );
  const [resetLab, setResetLab] = useState(true);
  const askReset = () => {
    setAsking("reset");
    void labResetAvailabilityAction({ runId }).then(setLabReset);
  };

  if (!asking) {
    return (
      <div className="flex flex-wrap gap-4 px-1 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => setAsking("replan")}
          className="hover:text-foreground hover:underline"
        >
          Plan these steps again
        </button>
        <button
          type="button"
          onClick={askReset}
          className="hover:text-foreground hover:underline"
        >
          Start the project over
        </button>
        {note ? <span className="text-foreground">{note}</span> : null}
      </div>
    );
  }

  const reset = asking === "reset";
  return (
    <div className="flex flex-wrap items-center gap-2 px-1 text-xs">
      <span>
        {reset
          ? "Start over from step one? Every step is planned again — finished ones too."
          : "Replan the steps you haven't finished? Finished steps and their results stay."}
      </span>
      {reset && labReset ? (
        labReset.available ? (
          <label className="flex w-full items-center gap-2 text-muted-foreground">
            <input
              type="checkbox"
              checked={resetLab}
              onChange={(event) => setResetLab(event.target.checked)}
            />
            Also give the lab a clean disk from your saved base — minutes, no download, no Setup.
          </label>
        ) : labReset.reason ? (
          <span className="w-full text-muted-foreground">Lab: {labReset.reason}</span>
        ) : null
      ) : null}
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() =>
          start(async () => {
            const res = reset
              ? await resetProjectAction({ runId })
              : await replanProjectAction({ runId });
            if (!res.ok) return setNote(res.message ?? "Couldn't plan it again.");
            let labNote = "";
            if (reset && resetLab && labReset?.available) {
              const proposed = await proposeLabResetAction({ runId });
              labNote = ` ${proposed.message}`;
              announceActionsChanged();
            }
            setAsking(null);
            setNote(reset ? `${res.message ?? ""}${labNote}`.trim() || null : null);
            await onReplanned();
          })
        }
      >
        {busy ? "Planning…" : reset ? "Start over" : "Replace"}
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAsking(null)}>
        Cancel
      </Button>
      {note ? <span className="text-amber-600">{note}</span> : null}
    </div>
  );
}

/**
 * Keep this Windows install for the next lab. Offered only while the lab is paused: a copy
 * taken while Windows writes to its disk is a broken disk. The action says why when it cannot.
 */
function SaveBaseLink({ runId }: { runId: string }) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <p className="text-xs text-muted-foreground">
      <button
        type="button"
        disabled={busy}
        className="text-primary hover:underline disabled:opacity-60"
        onClick={() =>
          start(async () => {
            const result = await proposeSaveBaseAction({ runId });
            setNote(result.message ?? null);
            if (result.ok) announceActionsChanged();
          })
        }
      >
        {busy ? "Checking…" : "Keep this install as the base for new Windows labs"}
      </button>{" "}
      {note ?? "— the next one skips the 8 GB download and the hour of Setup."}
    </p>
  );
}
