"use client";

import { ChevronDown, History } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  planHistoryAction,
  restorePlanAction,
  type PlanVersionView,
} from "@/app/dashboard/learning/plan-history-actions";

/**
 * EARLIER PLANS. Starting over or re-planning gives different steps; if the person preferred
 * the earlier way, it is here in full — read it, or bring it back with its progress.
 */
export function PlanHistory({
  runId,
  stepsKey,
  onRestored,
}: {
  runId: string;
  /** Changes whenever the steps change, so the list follows. */
  stepsKey: string;
  onRestored: (message: string) => Promise<void>;
}) {
  const [versions, setVersions] = useState<PlanVersionView[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    void planHistoryAction({ runId }).then((result) => {
      if (alive && result.ok) setVersions(result.versions);
    });
    return () => {
      alive = false;
    };
  }, [runId, stepsKey]);

  if (versions.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <History className="size-4 text-muted-foreground" aria-hidden="true" />
        Earlier plans
      </p>
      <ul className="space-y-2">
        {versions.map((version) => (
          <li key={version.id} className="rounded-xl border border-border/70">
            <button
              type="button"
              onClick={() => setOpen(open === version.id ? null : version.id)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  Plan {version.version} · {version.total} steps, {version.done} done
                </span>
                <span className="block text-xs text-muted-foreground">
                  {version.when} — {version.why}
                </span>
              </span>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${open === version.id ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            {open === version.id ? (
              <div className="space-y-3 border-t border-border/70 px-3 py-3">
                <ol className="space-y-2">
                  {version.steps.map((step) => (
                    <li key={step.ordinal} className="text-xs">
                      <p className="font-medium text-foreground">
                        {step.ordinal}. {step.title}
                        {step.status === "done" ? (
                          <span className="ml-2 text-success">done</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 whitespace-pre-line text-muted-foreground">
                        {step.instruction}
                      </p>
                      {step.artifact ? (
                        <p className="mt-0.5 text-muted-foreground">Result: {step.artifact}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
                {confirm === version.id ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span>Switch to this plan? The plan you are on now is kept here too.</span>
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await restorePlanAction({ runId, versionId: version.id });
                          setConfirm(null);
                          setOpen(null);
                          await onRestored(result.message);
                        })
                      }
                    >
                      {pending ? "Switching…" : "Use this plan"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setConfirm(version.id)}>
                    Use this plan again
                  </Button>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
