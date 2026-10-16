"use client";

import {
  Check,
  ChevronDown,
  Circle,
  CircleDot,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { conductorAction } from "@/app/dashboard/learning/conductor-actions";
import { proposeCleanSnapshotAction } from "@/app/dashboard/learning/fresh-start-actions";
import { proposeProjectLabAction, replanProjectAction } from "@/app/dashboard/learning/lab-actions";
import { proposeServiceAction } from "@/app/dashboard/learning/stack-actions";
import { CommandBlock } from "@/components/learning/step-text";
import { Button } from "@/components/ui/button";
import type { ConductorItem, ConductorView } from "@/lib/lab/conductor/evaluate";

/**
 * NEXT — the one thing to do now for this project's lab, why, what Fadi saw, and one action
 * (guided labs, G-1). Everything else Fadi checked sits behind "What Fadi checked". It follows
 * the workspace's own refresh (`tick`) instead of running a timer of its own; observations
 * are only re-taken when stale, so a refresh is cheap.
 */
export function ProjectNext({
  runId,
  tick,
  onChanged,
}: {
  runId: string;
  tick: number;
  /** A remedy was proposed or the plan changed: refresh approvals and the project. */
  onChanged: (message: string | null) => void;
}) {
  const [view, setView] = useState<ConductorView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);

  const load = useCallback(
    async (recheck?: string[]) => {
      if (inFlight.current && !recheck) return; // a slow probe is still answering
      inFlight.current = true;
      try {
        const result = await conductorAction({ runId, recheck });
        if (result.ok) setView(result.view);
      } finally {
        inFlight.current = false;
      }
    },
    [runId]
  );

  useEffect(() => {
    void load();
  }, [load, tick]);

  if (!view) return null;
  const { next } = view;
  const attention = view.items.filter(
    (item) => item.blocking === "soft" && item.state === "open" && item.verdict === "fail"
  );

  const recheck = (ids: string[]) => {
    setChecking(true);
    void load(ids).finally(() => setChecking(false));
  };

  const act = (item: ConductorItem) => {
    const remedy = item.remedy;
    if (!remedy || remedy.kind === "manual") return;
    setMessage(null);
    if (remedy.id === "checks.setup" || remedy.id === "machine.choose") {
      document
        .getElementById(remedy.id === "checks.setup" ? "lab-checks" : "lab-machine")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    startTransition(async () => {
      const result =
        remedy.id === "lab.start"
          ? await proposeProjectLabAction({ runId })
          : remedy.id === "vmware.snapshot"
            ? await proposeCleanSnapshotAction({ runId })
            : remedy.id === "stack.start" && remedy.stack
              ? await proposeServiceAction({ runId, stack: remedy.stack, op: "start" })
              : remedy.id === "plan.create"
                ? await replanProjectAction({ runId })
                : null;
      if (!result) return;
      const text =
        "message" in result && typeof result.message === "string" ? result.message : null;
      if (!result.ok) setMessage(text ?? "That didn't work. Nothing changed.");
      onChanged(text);
      await load([item.id]);
    });
  };

  if (!next) {
    return (
      <section className="rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Check className="size-4 text-emerald-500" aria-hidden="true" />
          <span className="font-medium">The lab is ready</span>
          <span className="text-muted-foreground">
            — everything this project needs is in place.
          </span>
          <DetailsToggle open={open} setOpen={setOpen} />
        </div>
        {attention.map((item) => (
          <SoftWarning key={item.id} item={item} />
        ))}
        {open ? <Checked items={view.items} /> : null}
      </section>
    );
  }

  const done = view.items.filter((item) => item.state === "done").length;
  return (
    <section className="rounded-2xl border border-primary/40 bg-card p-5" aria-live="polite">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
        Next
        <span className="font-normal normal-case tracking-normal text-muted-foreground">
          · {done} of {view.items.length} ready
        </span>
      </div>
      <h2 className="mt-1 font-heading text-lg font-semibold">{next.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{next.why}</p>
      {next.seen ? (
        <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Fadi saw: </span>
          {next.seen}
        </p>
      ) : null}

      {next.remedy?.kind === "manual" ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm">{next.remedy.explain}</p>
          {next.remedy.commands.map((command) => (
            <CommandBlock key={command} code={command} lang="bash" typeable={false} />
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {next.remedy && next.remedy.kind !== "manual" ? (
          next.remedy.waiting ? (
            <span className="text-sm text-muted-foreground">
              Waiting for your approval — it&apos;s in your approvals.
            </span>
          ) : (
            <Button size="sm" disabled={pending} onClick={() => act(next)}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {next.remedy.label}
            </Button>
          )
        ) : null}
        <Button
          size="sm"
          variant={next.remedy && next.remedy.kind !== "manual" ? "ghost" : "default"}
          disabled={checking}
          onClick={() => recheck([next.id])}
        >
          {checking ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
          {next.remedy?.kind === "manual" ? "I've done it — check again" : "Check again"}
        </Button>
        <DetailsToggle open={open} setOpen={setOpen} />
      </div>
      {message ? <p className="mt-2 text-sm text-destructive">{message}</p> : null}
      {attention.map((item) => (
        <SoftWarning key={item.id} item={item} />
      ))}
      {open ? <Checked items={view.items} /> : null}
    </section>
  );
}

function DetailsToggle({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  return (
    <button
      type="button"
      className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
    >
      What Fadi checked
      <ChevronDown
        className={`size-3.5 transition ${open ? "rotate-180" : ""}`}
        aria-hidden="true"
      />
    </button>
  );
}

function SoftWarning({ item }: { item: ConductorItem }) {
  return (
    <p className="mt-3 flex gap-2 text-sm text-amber-600 dark:text-amber-400">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        {item.title}: no. {item.seen}
      </span>
    </p>
  );
}

const ICON: Record<ConductorItem["state"], typeof Check> = {
  done: Check,
  next: CircleDot,
  open: CircleDot,
  waiting: Circle,
};

function Checked({ items }: { items: ConductorItem[] }) {
  return (
    <ol className="mt-4 space-y-2 border-t border-border/70 pt-3">
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
            <div className="min-w-0">
              <p className={item.state === "waiting" ? "text-muted-foreground" : ""}>
                {item.title}
                {item.blocking === "soft" ? (
                  <span className="text-muted-foreground"> (helpful, not required)</span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.state === "waiting"
                  ? "After the ones above."
                  : item.verdict === "unknown"
                    ? `Couldn't tell: ${item.seen ?? "no answer"}`
                    : (item.seen ?? "Not checked yet.")}
                {item.observedAt && item.state !== "waiting"
                  ? ` · ${new Date(item.observedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
