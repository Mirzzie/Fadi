"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ChevronRight } from "lucide-react";

import {
  listComputerLabsAction,
  proposeRemoveLeftoverLabAction,
  type ComputerLabView,
  type LeftoverLabView,
} from "@/app/dashboard/learning/lab-actions";
import { announceActionsChanged } from "@/components/os/pending-actions";
import { Button } from "@/components/ui/button";

function dot(phase: string) {
  if (phase === "ready") return "bg-emerald-500";
  if (phase === "failed") return "bg-destructive";
  if (phase === "stopped") return "bg-muted-foreground/40";
  return "animate-pulse bg-amber-500";
}

/** Each project's lab on this computer; starting and stopping happen in the project. */
export function ComputerLabs() {
  const [labs, setLabs] = useState<ComputerLabView[] | null>(null);
  const [leftovers, setLeftovers] = useState<LeftoverLabView[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const result = await listComputerLabsAction();
      if (alive && result.ok) {
        setLabs(result.labs);
        setLeftovers(result.leftovers);
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

  if (!labs || (labs.length === 0 && leftovers.length === 0)) return null;

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
      {leftovers.map((lab) => (
        <li key={lab.name} className="flex items-center gap-3 px-4 py-2.5">
          <span
            className="size-2 shrink-0 rounded-full bg-muted-foreground/40"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono text-sm">fadi-{lab.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {lab.detail} · not part of a current project
            </span>
          </span>
          {lab.container ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                start(async () => {
                  const result = await proposeRemoveLeftoverLabAction({ name: lab.name });
                  setNote(result.message ?? null);
                  if (result.ok) announceActionsChanged();
                })
              }
            >
              {lab.keptData ? "Remove container · keep data" : "Remove"}
            </Button>
          ) : null}
        </li>
      ))}
      {note ? <li className="px-4 py-2 text-xs text-muted-foreground">{note}</li> : null}
    </ul>
  );
}
