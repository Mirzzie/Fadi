"use client";

import { AlertTriangle, CheckCircle2, OctagonX } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import {
  projectReadinessAction,
  proposeMachineFixAction,
} from "@/app/dashboard/learning/readiness-actions";
import { Button } from "@/components/ui/button";
import type { Readiness } from "@/lib/lab/readiness";

/**
 * "Before you start": whether this project's lab fits this computer and will run well,
 * measured, with what to do about anything that stands in the way.
 */
export function ProjectReadiness({
  runId,
  tick,
  onProposed,
}: {
  runId: string;
  tick: number;
  onProposed: (message: string) => void;
}) {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [pending, startTransition] = useTransition();
  const fix = (kind: "memory" | "move") =>
    startTransition(async () => {
      const result = await proposeMachineFixAction({ runId, fix: kind });
      onProposed(result.message);
    });

  useEffect(() => {
    let alive = true;
    void projectReadinessAction({ runId }).then((result) => {
      if (alive && result.ok) setReadiness(result.readiness);
    });
    return () => {
      alive = false;
    };
    // Every few polls is plenty: memory and disks do not change by the second.
  }, [runId, Math.floor(tick / 4)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!readiness || readiness.checks.length === 0) return null;
  const heading =
    readiness.verdict === "blocked"
      ? "This won't fit on this computer yet"
      : readiness.verdict === "slow"
        ? "It will run, but slowly"
        : "Ready to run here";

  return (
    <div className="border-b border-border/70 px-4 py-3">
      <p className="mb-2 text-xs text-muted-foreground">Before you start — {heading}</p>
      <ul className="space-y-1.5">
        {readiness.checks.map((check) => (
          <li key={check.id} className="flex gap-2 text-xs">
            {check.level === "ok" ? (
              <CheckCircle2
                className="mt-0.5 size-3.5 shrink-0 text-emerald-500"
                aria-hidden="true"
              />
            ) : check.level === "warn" ? (
              <AlertTriangle
                className="mt-0.5 size-3.5 shrink-0 text-amber-500"
                aria-hidden="true"
              />
            ) : (
              <OctagonX className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden="true" />
            )}
            <span>
              {check.text}
              {check.fix ? <span className="text-muted-foreground"> {check.fix}</span> : null}
            </span>
            {check.id === "vm-memory" || check.id === "vm-disk" ? (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto h-6 shrink-0 px-2 text-xs"
                disabled={pending}
                onClick={() => fix(check.id === "vm-memory" ? "memory" : "move")}
              >
                {check.id === "vm-memory" ? "Give it more memory" : "Move to SSD"}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
