"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";

import { listComputerLabsAction, type ComputerLabView } from "@/app/dashboard/learning/lab-actions";

function dot(phase: string) {
  if (phase === "ready") return "bg-success";
  if (phase === "failed") return "bg-destructive";
  if (phase === "stopped") return "bg-muted-foreground/40";
  return "animate-pulse bg-warning";
}

/** Each project's lab on this computer; starting and stopping happen in the project. */
export function ComputerLabs() {
  const [labs, setLabs] = useState<ComputerLabView[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const result = await listComputerLabsAction();
      if (alive && result.ok) {
        setLabs(result.labs);
      }
    };
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!labs || labs.length === 0) return null;

  return (
    <ul className="divide-y divide-border/60 border-t border-border/60">
      {labs.map((lab) => (
        <li key={lab.runId}>
          <Link
            href={`/dashboard/learning/projects/${lab.runId}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40"
          >
            <span className={`size-2 shrink-0 rounded-full ${dot(lab.phase)}`} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">
                {lab.labLabel} <span className="text-muted-foreground">· {lab.projectTitle}</span>
              </span>
              <span className="block truncate text-xs text-muted-foreground">{lab.detail}</span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        </li>
      ))}
      {/* Labs without a current project are listed, with their size and removal, in the
          disk list below (LabDisks) — one place to decide what to delete, not two. */}
    </ul>
  );
}
