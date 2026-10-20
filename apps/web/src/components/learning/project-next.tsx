"use client";

import { Check, ChevronDown, Circle, CircleDot, Loader2, RefreshCw } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";

import { proposeLabFixAction } from "@/app/dashboard/learning/conductor-actions";
import { proposeCleanSnapshotAction } from "@/app/dashboard/learning/fresh-start-actions";
import { replanProjectAction } from "@/app/dashboard/learning/lab-actions";
import { proposeServiceAction } from "@/app/dashboard/learning/stack-actions";
import { CommandBlock } from "@/components/learning/step-text";
import { Button } from "@/components/ui/button";
import type { ConductorItem, ConductorView } from "@/lib/lab/conductor/evaluate";

/**
 * NEXT, WHILE THE ENVIRONMENT NEEDS SOMETHING — what, why, what Fadi saw, and ONE action that
 * changes with the state (guided labs, G-1). It renders nothing when the environment is ready:
 * then the current step is the Next card. It owns no polling — the workspace is the one refresh
 * owner and hands it the conductor's view — and an approval it asked for appears inside it.
 *
 * Replaced (16 Oct 2026, docs/UI_UX_GUIDELINES.md "Interaction budget"): the readiness panel
 * as the default, "waiting — it's in your approvals" pointers, and a separate Check again
 * beside the action (it is now the action when there is nothing else to do).
 */
export function ProjectNext({
  runId,
  view,
  approval,
  onChanged,
  onRecheck,
  onStartLab,
}: {
  runId: string;
  view: ConductorView;
  /** The pending approval this card's action created, rendered here — not somewhere else. */
  approval: ReactNode;
  onChanged: (message: string | null) => void;
  onRecheck: (ids: string[]) => Promise<void>;
  /** Start, resume or restart the lab, whichever its state needs. */
  onStartLab: () => Promise<{ ok: boolean; message?: string }>;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const next = view.next;
  if (!next) return null;
  const remedy = next.remedy;
  const done = view.items.filter((item) => item.state === "done").length;

  const run = (work: () => Promise<{ ok: boolean; message?: string } | null | void>) =>
    startTransition(async () => {
      setMessage(null);
      const result = await work();
      if (result && !result.ok) setMessage(result.message ?? "That didn't work. Nothing changed.");
      onChanged(result && result.ok ? (result.message ?? null) : null);
      await onRecheck([next.id]);
    });

  // ONE action. What it is follows from the remedy; with none, it is to look again.
  let action: { label: string; go: () => void } = {
    label: "Check again",
    go: () => run(async () => undefined),
  };
  if (remedy?.kind === "recipe") {
    action = {
      label: remedy.label,
      go: () =>
        run(async () =>
          remedy.id === "lab.start"
            ? onStartLab()
            : remedy.id === "vmware.snapshot"
              ? proposeCleanSnapshotAction({ runId })
              : remedy.stack
                ? proposeServiceAction({ runId, stack: remedy.stack, op: "start" })
                : null
        ),
    };
  } else if (remedy?.kind === "flow") {
    action =
      remedy.id === "plan.create"
        ? { label: remedy.label, go: () => run(() => replanProjectAction({ runId })) }
        : {
            label: remedy.label,
            // Machine choice and checks setup live in Environment details: open them there.
            go: () =>
              window.dispatchEvent(new CustomEvent("fadi:environment", { detail: remedy.id })),
          };
  } else if (remedy?.kind === "manual" && remedy.fadiCanApply) {
    action = { label: "Fix it", go: () => run(() => proposeLabFixAction({ runId })) };
  } else if (remedy?.kind === "manual") {
    action = { label: "I've done it — check again", go: () => run(async () => undefined) };
  }

  return (
    <section className="rounded-2xl border border-primary/40 bg-card p-5" aria-live="polite">
      <p className="text-xs font-medium text-primary">
        Getting the lab ready
        <span className="font-normal text-muted-foreground">
          {" "}
          · {done} of {view.items.length}
        </span>
      </p>
      <h2 className="mt-1 font-heading text-lg font-semibold">{next.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {next.seen ? <>Fadi saw: {next.seen} </> : null}
        {next.why}
      </p>

      {/* Where the person must act themselves (sudo on this computer), the command is the task. */}
      {remedy?.kind === "manual" && !remedy.fadiCanApply ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm">{remedy.explain}</p>
          {remedy.commands.map((command) => (
            <CommandBlock
              key={command}
              code={command}
              lang={remedy.place === "lab" ? "powershell" : "bash"}
              typeable={remedy.place === "lab"}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        {approval ?? (
          <Button size="sm" disabled={pending || Boolean(remedy?.waiting)} onClick={action.go}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : action.label.startsWith("Check") || action.label.startsWith("I've") ? (
              <RefreshCw className="size-4" aria-hidden="true" />
            ) : null}
            {action.label}
          </Button>
        )}
      </div>
      {message ? <p className="mt-2 text-sm text-destructive">{message}</p> : null}

      <button
        type="button"
        className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        What Fadi checked
        <ChevronDown
          className={`size-3.5 transition ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open ? <Checked items={view.items} next={next} /> : null}
    </section>
  );
}

const ICON: Record<ConductorItem["state"], typeof Check> = {
  done: Check,
  next: CircleDot,
  open: CircleDot,
  waiting: Circle,
};

/** Every requirement, with what was seen — and manual commands, for those who want them. */
export function Checked({ items, next }: { items: ConductorItem[]; next?: ConductorItem | null }) {
  return (
    <ol className="mt-3 space-y-2 border-t border-border/70 pt-3">
      {items.map((item) => {
        const Icon = ICON[item.state];
        return (
          <li key={item.id} className="flex gap-2 text-sm">
            <Icon
              className={`mt-0.5 size-4 shrink-0 ${
                item.state === "done"
                  ? "text-emerald-500"
                  : item.state === "waiting"
                    ? "text-muted-foreground/50"
                    : "text-primary"
              }`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className={item.state === "waiting" ? "text-muted-foreground" : ""}>
                {item.title}
                {item.blocking === "soft" ? (
                  <span className="text-muted-foreground"> (suggested)</span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.state === "waiting"
                  ? "After the ones above."
                  : item.verdict === "unknown"
                    ? `Couldn't tell: ${item.seen ?? "no answer"}`
                    : (item.seen ?? "Not checked yet.")}
              </p>
              {/* Manual mode for a fix Fadi can also apply: under details, never beside it. */}
              {item.id === next?.id && item.remedy?.kind === "manual" && item.remedy.fadiCanApply
                ? item.remedy.commands.map((command) => (
                    <div key={command} className="mt-1">
                      <CommandBlock code={command} lang="powershell" typeable />
                    </div>
                  ))
                : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
