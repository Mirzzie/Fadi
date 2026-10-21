"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ExternalLink,
  LifeBuoy,
  Loader2,
  RotateCcw,
} from "lucide-react";

import {
  completeStepAction,
  getProjectRunAction,
  projectRuntimeAction,
  proposeProjectLabAction,
  proposeProjectLabResumeAction,
  proposeProjectLabStopAction,
  proposeSaveBaseAction,
  reopenStepAction,
  replanProjectAction,
  runOnThisComputerAction,
  type ProjectRuntimeView,
  type RunView,
  type StepView,
} from "@/app/dashboard/learning/lab-actions";
import type { StepCheck } from "@/lib/lab/completion";
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
import {
  proposeCleanSnapshotAction,
  proposeFreshStartAction,
} from "@/app/dashboard/learning/fresh-start-actions";
import { LabScreenFrame } from "@/components/learning/lab-screen-frame";
import { MachineChooser } from "@/components/learning/machine-chooser";
import { MachineSettings } from "@/components/learning/machine-settings";
import { PlanHistory } from "@/components/learning/plan-history";
import { ProjectBrief } from "@/components/learning/project-brief";
import { Checked, ProjectNext } from "@/components/learning/project-next";
import { DocumentStep, ReviewResult } from "@/components/learning/document-step";
import type { ReviewView } from "@/lib/practice/document-sim";
import { conductorAction } from "@/app/dashboard/learning/conductor-actions";
import { restartPracticeActivityAction } from "@/app/dashboard/learning/practice-actions";
import type { ConductorView } from "@/lib/lab/conductor/evaluate";
import { stepScript } from "@/lib/learning/instruction-blocks";
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
  const [conductor, setConductor] = useState<ConductorView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // A work-simulation step just passed: its review (and example answer) stays once above the next.
  const [passed, setPassed] = useState<{ title: string; review: ReviewView } | null>(null);
  const [labMessage, setLabMessage] = useState<string | null>(null);
  const [environmentOpen, setEnvironmentOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [pending, startTransition] = useTransition();
  const { pending: approvals, refresh: refreshApprovals } = usePendingActions();
  const projectInFlight = useRef(false);
  const conductorInFlight = useRef(false);

  // THE ONE REFRESH OWNER for this page (docs/UI_UX_GUIDELINES.md): the project and its machine,
  // and the conductor, on one timer. The conductor can take a while (it may ask inside the
  // machine), so it never holds the project back, and neither is ever asked twice at once.
  // Background refresh is never inside startTransition: every poll would flip `pending` and make
  // every button flash.
  const refreshProject = useCallback(async () => {
    if (projectInFlight.current) return;
    projectInFlight.current = true;
    try {
      const [result, observed] = await Promise.all([
        getProjectRunAction({ runId }),
        projectRuntimeAction({ runId }),
      ]);
      setRun(result.ok ? result.run : null);
      setRuntime(observed.ok ? observed.runtime : null);
      setTick((value) => value + 1);
    } finally {
      projectInFlight.current = false;
    }
  }, [runId]);

  const refreshConductor = useCallback(
    async (recheck?: string[]) => {
      if (conductorInFlight.current && !recheck) return;
      conductorInFlight.current = true;
      try {
        const result = await conductorAction({ runId, recheck });
        if (result.ok) setConductor(result.view);
      } finally {
        conductorInFlight.current = false;
      }
    },
    [runId]
  );

  const refresh = useCallback(async () => {
    void refreshConductor();
    await refreshProject();
  }, [refreshConductor, refreshProject]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 8_000);
    return () => clearInterval(timer);
  }, [refresh]);

  // The Next card sends "choose a machine" / "set up checks" here: open Environment details.
  useEffect(() => {
    const open = () => setEnvironmentOpen(true);
    window.addEventListener("fadi:environment", open);
    return () => window.removeEventListener("fadi:environment", open);
  }, []);

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

  const changed = (text: string | null) => {
    if (text) setLabMessage(text);
    announceActionsChanged();
    refreshApprovals();
    void refreshProject();
  };

  const completeCurrent = (input: { unverified: boolean; artifact: string | null }) => {
    if (!current) return;
    setMessage(null);
    startTransition(async () => {
      const result = await completeStepAction({ stepId: current.id, ...input });
      if (!result.ok) {
        await refreshProject();
        return setMessage(
          result.reason === "check_failed"
            ? "Fadi's check of this step failed, so it isn't done."
            : result.reason === "check_waiting"
              ? "A check of this step is waiting for your approval — approve or decline it first."
              : "Couldn't save that. Nothing changed."
        );
      }
      await refresh();
    });
  };

  /** Start, resume or restart the lab — whichever its observed state needs. */
  const startLab = async () => {
    let result =
      runtime && runtime.phase === "stopped"
        ? await proposeProjectLabResumeAction({ runId })
        : await proposeProjectLabAction({ runId });
    // A lab that failed before its container existed has nothing to resume: create it.
    if (!result.ok && runtime?.phase === "failed")
      result = await proposeProjectLabAction({ runId });
    return { ok: result.ok, message: result.message };
  };

  const pauseLab = () =>
    startTransition(async () => {
      const result = await proposeProjectLabStopAction({ runId });
      changed(result.ok ? (result.message ?? null) : (result.message ?? "That didn't work."));
    });

  const total = run.steps.length;
  const percent = total === 0 ? 0 : Math.round((run.doneCount / total) * 100);
  const hasLab = Boolean(run.labTemplate);
  // While the environment needs something, that is the Next card; then the current step is.
  const environmentNext = hasLab && conductor?.next ? conductor : null;
  // An approval appears where its action was asked: a step's run or check on the step, the
  // rest on the environment card — or, when neither is showing, on top of the column.
  const approvalCard = approval ? (
    <PendingAction
      w={approval}
      onSettled={(result) => {
        setLabMessage(result);
        refreshApprovals();
        void refresh();
      }}
    />
  ) : null;
  const stepApproval = approval?.recipe === "lab.check" ? approvalCard : null;
  const environmentApproval = approval && approval.recipe !== "lab.check" ? approvalCard : null;

  return (
    <div className="space-y-4">
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
            {total === 0
              ? "Not planned yet"
              : current
                ? `Step ${current.ordinal} of ${total}`
                : "All steps done"}
          </span>
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-border" aria-hidden="true">
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </header>

      <div
        className={
          hasLab
            ? "grid items-start gap-4 lg:grid-cols-[minmax(22rem,4fr)_minmax(28rem,8fr)]"
            : "mx-auto max-w-3xl space-y-4"
        }
      >
        <div className="space-y-4">
          {environmentNext ? (
            <ProjectNext
              runId={runId}
              view={environmentNext}
              approval={environmentApproval}
              onChanged={changed}
              onRecheck={(ids) => refreshConductor(ids)}
              onStartLab={startLab}
            />
          ) : environmentApproval && !stepApproval ? (
            environmentApproval
          ) : null}

          {run.steps.length === 0 ? (
            // A lab project is planned from the Next card (the conductor's last requirement).
            hasLab ? null : (
              <FreshStart runId={runId} onPlanned={refreshProject} />
            )
          ) : current && current.place === "document" ? (
            <>
              {passed ? <PassedNote passed={passed} onClose={() => setPassed(null)} /> : null}
              <DocumentStep
                key={current.id}
                runId={runId}
                step={current}
                brief={caseOf(run.detail)}
                onPassed={(review, title) => {
                  setPassed({ title, review });
                  void refreshProject();
                }}
              />
            </>
          ) : current ? (
            <CurrentStep
              key={current.id}
              runId={runId}
              step={current}
              pending={pending}
              message={message}
              onComplete={completeCurrent}
              onRevised={refreshProject}
              // Waits for the environment: the step reads, but its action is the Next card's.
              blocked={Boolean(environmentNext)}
              canCheck={Boolean(
                (run.target.kind === "vmware" ||
                  ((run.labShell || run.labSignIn) && run.target.kind === "local-docker")) &&
                runtime &&
                !["stopped", "failed", "queued", "stopping"].includes(runtime.phase)
              )}
              approval={stepApproval}
              check={run.currentCheck ?? { state: "none", detail: null }}
              onProposed={() => {
                announceActionsChanged();
                refreshApprovals();
              }}
            />
          ) : (
            <>
              {passed ? <PassedNote passed={passed} onClose={() => setPassed(null)} /> : null}
              <FinishReview runId={runId} stepsKey={run.steps.map((s) => s.status).join()} />
            </>
          )}

          {run.steps.length > 0 ? (
            <details className="group border border-border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm">
                <span className="font-medium">All steps</span>
                <span className="text-muted-foreground">
                  {run.doneCount} of {total} done
                </span>
                <ChevronDown
                  className="ml-auto size-4 text-muted-foreground transition group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="space-y-3 border-t border-border/70 p-3">
                <StepList
                  steps={run.steps}
                  currentId={current?.id ?? null}
                  pending={pending}
                  onReopen={(stepId) =>
                    startTransition(async () => {
                      await reopenStepAction({ stepId });
                      await refreshProject();
                    })
                  }
                />
                {/* Re-planning a work simulation would hand its pack steps to the AI planner, so
                    its one option here is the same "Start the project over" — with a new case. */}
                {run.isPractice ? (
                  current ? (
                    <StartPracticeOver runId={runId} />
                  ) : null
                ) : (
                  <Replan runId={runId} onReplanned={refresh} />
                )}
                <PlanHistory
                  runId={runId}
                  stepsKey={run.steps.map((s) => `${s.id}:${s.status}`).join()}
                  onRestored={async (text) => {
                    setMessage(text);
                    await refreshProject();
                  }}
                />
              </div>
            </details>
          ) : null}

          <ProjectBrief
            // A work simulation's case is shown in the step; here, only its outcome.
            detail={run.isPractice ? outcomeOf(run.detail) : run.detail}
            runsOn={
              hasLab
                ? run.target.kind === "local-docker"
                  ? `${run.labLabel ?? "a lab"} on this computer`
                  : run.target.label
                : null
            }
          />
        </div>

        {hasLab ? (
          <section className="overflow-hidden border border-border bg-card lg:sticky lg:top-12">
            {/* ONE environment line. Everything that used to be stacked here — machine choice,
                settings, checks setup, readiness, services, sign-in, base, pause — is behind it,
                and none of it polls while closed. */}
            <button
              type="button"
              aria-expanded={environmentOpen}
              onClick={() => setEnvironmentOpen((v) => !v)}
              className="flex w-full items-center gap-3 border-b border-border/70 px-4 py-2.5 text-left"
            >
              <span
                className={`size-2 shrink-0 rounded-full ${
                  conductor?.ready
                    ? "bg-success"
                    : runtime?.phase === "failed"
                      ? "bg-destructive"
                      : "bg-warning"
                }`}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium">Environment</span>{" "}
                <span className="text-muted-foreground">
                  · {run.labLabel}
                  {run.target.kind === "local-docker"
                    ? " on this computer"
                    : ` on ${run.target.label}`}{" "}
                  ·{" "}
                  {conductor?.ready
                    ? "ready"
                    : run.target.kind === "unconnected"
                      ? "not reachable"
                      : runtime
                        ? runtimeMessage(runtime)
                        : "needs attention"}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">Details</span>
              <ChevronDown
                className={`size-4 text-muted-foreground transition ${environmentOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>

            {environmentOpen ? (
              <div className="border-b border-border/70">
                <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
                  {run.labSignIn ? (
                    <span>
                      Sign in as{" "}
                      <code className="rounded bg-muted px-1 text-foreground">
                        {run.labSignIn.user}
                      </code>{" "}
                      · password{" "}
                      <code className="rounded bg-muted px-1 text-foreground">
                        {run.labSignIn.password}
                      </code>
                    </span>
                  ) : null}
                  {run.target.kind === "unconnected" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await runOnThisComputerAction({ runId });
                          changed(result.message ?? null);
                        })
                      }
                    >
                      Run on this computer instead
                    </Button>
                  ) : runtime && !["stopped", "failed", "queued"].includes(runtime.phase) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-7"
                      disabled={pending}
                      onClick={pauseLab}
                    >
                      Pause the machine
                    </Button>
                  ) : null}
                </div>
                {run.labSignIn && runtime?.phase === "stopped" ? (
                  <div className="px-4 pb-2">
                    <SaveBaseLink runId={runId} />
                  </div>
                ) : null}
                {!runtime || ["stopped", "failed"].includes(runtime.phase) ? (
                  <MachineChooser
                    runId={runId}
                    onkind={run.target.kind}
                    onChanged={(text) => changed(text)}
                  />
                ) : null}
                <MachineSettings runId={runId} tick={tick} onProposed={(text) => changed(text)} />
                <ChecksSetup runId={runId} tick={tick} />
                <ProjectServices runId={runId} tick={tick} onProposed={(text) => changed(text)} />
                <ProjectReadiness runId={runId} tick={tick} onProposed={(text) => changed(text)} />
                {runtime && run.labShell && runtime.phase !== "stopped" ? (
                  <div className="p-4">
                    <p className="mb-2 text-xs text-muted-foreground">
                      A terminal into the lab, from your computer:
                    </p>
                    <CommandBlock code={run.labShell} lang="terminal" />
                  </div>
                ) : null}
                {/* The checklist lives in the Next card while there is one; here only once the
                    lab is ready and the Next card has gone — never both at once. */}
                {conductor && !environmentNext ? (
                  <div className="px-4 pb-3">
                    <Checked items={conductor.items} />
                  </div>
                ) : null}
              </div>
            ) : null}
            {labMessage ? (
              <p className="border-b border-border/70 px-4 py-2 text-xs text-muted-foreground">
                {labMessage}
              </p>
            ) : null}

            <LabSurface runtime={runtime} labLabel={run.labLabel} />
          </section>
        ) : null}
      </div>
    </div>
  );
}

function LabSurface({
  runtime,
  labLabel,
}: {
  runtime: ProjectRuntimeView | undefined;
  labLabel: string | null;
}) {
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

/**
 * THE CURRENT STEP, when the environment is ready: what to do, what "done" means, and ONE
 * action that follows the state — Run in lab (Fadi runs the step's script in the machine, then
 * its check, after one approval), Check and continue (the person did it; Fadi checks), or Done.
 *
 * Replaced (16 Oct 2026, docs/UI_UX_GUIDELINES.md "Interaction budget"): Type into lab and Copy
 * on every command, the result field, and Done / Check it for me / Continue without verification
 * side by side. Commands, manual completion and help are under "Other ways".
 */
function CurrentStep({
  runId,
  step,
  pending,
  message,
  onComplete,
  onRevised,
  blocked,
  canCheck,
  approval,
  check,
  onProposed,
}: {
  runId: string;
  step: StepView;
  pending: boolean;
  message: string | null;
  onComplete: (input: { unverified: boolean; artifact: string | null }) => void;
  onRevised: () => Promise<void>;
  /** The environment needs something first: the Next card above has the action. */
  blocked: boolean;
  canCheck: boolean;
  /** This step's pending run or check, shown where it was asked for. */
  approval: React.ReactNode;
  check: StepCheck;
  onProposed: () => void;
}) {
  const [other, setOther] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [artifact, setArtifact] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [asking, startAsk] = useTransition();

  const script = stepScript(step.instruction);
  const inLab = !step.place || step.place === "lab";
  // A LEARNING step is the person's to do; Fadi checks it. Fadi runs only its own setup work
  // (place "fadi"). The owner, 17 Oct 2026: "it must not be like I click, copy-paste commands,
  // then ok ok ok, done — that negates the whole purpose." Run in lab on a learning step was
  // exactly that, so it is gone; the commands stay as guidance the person types themselves.
  const canRun = canCheck && step.place === "fadi" && Boolean(script) && Boolean(step.check);
  // Fadi checks inside the lab only. A browser step's result is on the person's screen.
  const canCheckHere = canCheck && inLab;
  const failed = check.state === "failed";

  const ask = (run: boolean) =>
    startAsk(async () => {
      setNote(null);
      const result = await proposeStepCheckAction({ runId, stepId: step.id, run });
      if (result.ok) onProposed();
      else setNote(result.message);
    });

  // ONE action, by state.
  let primary: React.ReactNode;
  if (blocked) {
    primary = (
      <p className="text-sm text-muted-foreground">Fadi is getting the lab ready first — above.</p>
    );
  } else if (approval) {
    primary = approval;
  } else if (check.state === "waiting") {
    primary = (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Running in the lab…
      </p>
    );
  } else {
    const [label, go] = canRun
      ? [failed ? "Run again" : "Run in lab", () => ask(true)]
      : canCheckHere
        ? [failed ? "Check again" : "Check and continue", () => ask(false)]
        : ["Done, continue", () => onComplete({ unverified: false, artifact: null })];
    primary = (
      <Button onClick={go} disabled={pending || asking}>
        {pending || asking ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Check aria-hidden="true" />
        )}
        {label}
      </Button>
    );
  }

  return (
    <section className="border border-primary/30 bg-card p-5">
      <p className="flex items-center gap-2 text-xs font-medium text-primary">
        Step {step.ordinal}
        {step.place ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {PLACE_LABEL[step.place] ?? step.place}
          </span>
        ) : null}
      </p>
      <h2 className="mt-0.5 text-lg font-semibold">{step.title}</h2>

      {/* The task in words. The commands themselves are Fadi's to run; they are under Other ways. */}
      <StepText
        text={step.instruction}
        hideCommands={canRun}
        typeable={inLab}
        className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground"
      />

      {step.verify ? (
        <p className="mt-3 text-sm">
          <span className="font-medium text-success">Done when </span>
          <span className="text-muted-foreground">{step.verify}</span>
        </p>
      ) : null}

      {failed ? (
        <div className="mt-4 rounded-lg bg-destructive/5 px-3 py-2.5 ring-1 ring-destructive/30">
          <p className="text-sm font-medium text-destructive">
            Fadi checked: it didn&apos;t work yet.
          </p>
          {check.detail ? (
            <p className="mt-1 text-sm text-muted-foreground">{check.detail}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {primary}
        {failed && !blocked ? (
          <button
            type="button"
            onClick={() => setStuck(true)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <LifeBuoy className="size-4" aria-hidden="true" /> Need help?
          </button>
        ) : null}
      </div>
      {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
      {note ? <p className="mt-2 text-sm text-muted-foreground">{note}</p> : null}

      {stuck ? (
        <StuckPanel
          runId={runId}
          step={step}
          onClose={() => setStuck(false)}
          onRevised={onRevised}
          // After Fadi's own run or check failed, it explains from what the machine printed.
          fromFadi={failed}
        />
      ) : null}

      <button
        type="button"
        aria-expanded={other}
        onClick={() => setOther((v) => !v)}
        className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        Other ways
        <ChevronDown
          className={`size-3.5 transition ${other ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {other ? (
        <div className="mt-3 space-y-4 border-t border-border/70 pt-3 text-sm">
          {canRun && script ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Do it yourself in the machine — when practising the commands is the point:
              </p>
              <StepText
                text={step.instruction}
                commandsOnly
                typeable={inLab}
                className="space-y-2 text-sm text-muted-foreground"
              />
              {canCheckHere ? (
                <Button size="sm" variant="outline" disabled={asking} onClick={() => ask(false)}>
                  I did it — check it
                </Button>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {failed || check.state === "waiting"
                ? "Mark it done without Fadi's check — it counts as your word only, never as evidence."
                : "Mark it done yourself, with what it produced if you like:"}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {failed || check.state === "waiting" ? null : (
                <input
                  value={artifact}
                  onChange={(event) => setArtifact(event.target.value)}
                  placeholder={
                    step.produces ? `Result: ${step.produces}` : "Result: a path, output or link"
                  }
                  aria-label="Result of this step"
                  className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm"
                />
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  onComplete({
                    unverified: failed || check.state === "waiting",
                    artifact: artifact.trim() || null,
                  })
                }
              >
                Mark done
              </Button>
            </div>
          </div>
          {failed || stuck ? null : (
            <button
              type="button"
              onClick={() => setStuck(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <LifeBuoy className="size-3.5" aria-hidden="true" /> Stuck? Show Fadi the error
            </button>
          )}
        </div>
      ) : null}
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
  fromFadi = false,
}: {
  runId: string;
  step: StepView;
  onClose: () => void;
  onRevised: () => Promise<void>;
  /** Fadi ran or checked this step and kept what it printed: explain that, ask for nothing. */
  fromFadi?: boolean;
}) {
  const [output, setOutput] = useState("");
  const [help, setHelp] = useState<StepHelp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    if (!fromFadi) return;
    start(async () => {
      const result = await helpWithStepAction({ runId, stepId: step.id, output: "" });
      if (result.ok) setHelp(result.help);
      else setError(result.message);
    });
  }, [fromFadi, runId, step.id]);

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
      {!help && fromFadi ? (
        busy ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Reading what the machine
            printed…
          </p>
        ) : null
      ) : !help ? (
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
            {fromFadi ? null : (
              <Button size="sm" variant="ghost" onClick={() => setHelp(null)}>
                Paste more output
              </Button>
            )}
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
    <ol className="border border-border bg-card py-1">
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

/**
 * A work simulation starts over with a NEW case — new figures, steps from the beginning. The
 * attempt in progress is closed, not deleted: its submissions and reviews stay on its record.
 */
function StartPracticeOver({ runId }: { runId: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  if (!asking) {
    return (
      <div className="px-1 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="hover:text-foreground hover:underline"
        >
          Start the project over
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 px-1 text-xs">
      <span className="w-full">
        Start over with a new case: new figures, from step one. This attempt is closed, and what you
        handed in stays on its record.
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() =>
          start(async () => {
            const result = await restartPracticeActivityAction({ runId });
            if (!result.ok) return setNote(result.message);
            router.push(`/dashboard/learning/projects/${result.runId}`);
          })
        }
      >
        {busy ? "Preparing…" : "Start over with a new case"}
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAsking(false)}>
        Cancel
      </Button>
      {note ? <span className="w-full text-warning">{note}</span> : null}
    </div>
  );
}

/** Behind a confirmation: unfinished steps are replaced; finished steps and their results are kept. */
function Replan({ runId, onReplanned }: { runId: string; onReplanned: () => Promise<void> }) {
  const [asking, setAsking] = useState<null | "replan" | "reset">(null);
  const [note, setNote] = useState<string | null>(null);
  const [needsSnapshot, setNeedsSnapshot] = useState(false);
  // No clean start to go back to: the same button then starts over WITHOUT resetting the
  // machine, and says so. It replaces "Start over from nothing", never sits beside it.
  const [keepMachine, setKeepMachine] = useState(false);
  const [busy, start] = useTransition();

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
          onClick={() => setAsking("reset")}
          className="hover:text-foreground hover:underline"
        >
          Start the project over
        </button>
        {note ? <span className="text-foreground">{note}</span> : null}
      </div>
    );
  }

  const reset = asking === "reset";
  const done = (message: string) => {
    setAsking(null);
    setNeedsSnapshot(false);
    setKeepMachine(false);
    setNote(message);
    announceActionsChanged();
  };
  return (
    <div className="flex flex-wrap items-center gap-2 px-1 text-xs">
      <span className="w-full">
        {reset
          ? "Start the project over from nothing: its progress, steps and earlier plans are deleted, and its machine starts clean — Fadi's lab gets a fresh disk from your saved base (no download), your VMware machine returns to its clean start, and services lose their data. Then choose where it runs and plan it again."
          : "Replan the steps you haven't finished? Finished steps and their results stay."}
      </span>
      {needsSnapshot ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const result = await proposeCleanSnapshotAction({ runId });
              setNote(result.message);
              announceActionsChanged();
            })
          }
        >
          Save clean start
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() =>
          start(async () => {
            if (reset) {
              const result = await proposeFreshStartAction({ runId, keepMachine });
              if (!result.ok) {
                setNeedsSnapshot(Boolean(result.needsSnapshot));
                setKeepMachine(Boolean(result.canKeepMachine));
                return setNote(result.message);
              }
              done(result.message);
              await onReplanned();
              return;
            }
            const res = await replanProjectAction({ runId });
            if (!res.ok) return setNote(res.message ?? "Couldn't plan it again.");
            setAsking(null);
            setNote(null);
            await onReplanned();
          })
        }
      >
        {busy
          ? reset
            ? "Preparing…"
            : "Planning…"
          : reset
            ? keepMachine
              ? "Start over, keep the machine as it is"
              : "Start over from nothing"
            : "Replace"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={() => {
          setAsking(null);
          setNeedsSnapshot(false);
          setKeepMachine(false);
        }}
      >
        Cancel
      </Button>
      {note ? <span className="w-full text-warning">{note}</span> : null}
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

/** Where a step happens, in the person's words. */
const PLACE_LABEL: Record<string, string> = {
  lab: "In the lab",
  browser: "In your browser",
  fadi: "Fadi does it",
};

/**
 * A project with no steps — just started over. Planning waits for the person: choose where it
 * runs and start it, so the plan is written against the fresh machine as observed.
 */
function FreshStart({ runId, onPlanned }: { runId: string; onPlanned: () => Promise<void> }) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <section className="border border-primary/30 bg-card p-5">
      <p className="text-xs font-medium text-primary">Fresh start</p>
      <h2 className="mt-0.5 text-lg font-semibold">Nothing done yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose where this project runs (on the right), start the machine, then plan the steps — Fadi
        looks at the running machine first, so the steps fit it.
      </p>
      <Button
        className="mt-4"
        size="sm"
        disabled={busy}
        onClick={() =>
          start(async () => {
            setNote(null);
            const result = await replanProjectAction({ runId });
            if (!result.ok) return setNote(result.message ?? "Couldn't plan it.");
            await onPlanned();
          })
        }
      >
        {busy ? "Planning…" : "Plan the steps"}
      </Button>
      {note ? <p className="mt-2 text-xs text-warning">{note}</p> : null}
    </section>
  );
}

/** A work simulation's run detail is its outcome, a blank line, then the case. */
function outcomeOf(detail: string | null): string | null {
  return detail?.split(/\n{2,}/)[0] ?? null;
}

function caseOf(detail: string | null): string | null {
  if (!detail) return null;
  const at = detail.search(/\n{2,}/);
  return at < 0 ? null : detail.slice(at).trim();
}

/** The review of the step that just passed, once, above the next step. */
function PassedNote({
  passed,
  onClose,
}: {
  passed: { title: string; review: ReviewView };
  onClose: () => void;
}) {
  return (
    <section className="border border-success/30 bg-card px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">“{passed.title}” passed.</p>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>
      <ReviewResult review={passed.review} />
    </section>
  );
}
