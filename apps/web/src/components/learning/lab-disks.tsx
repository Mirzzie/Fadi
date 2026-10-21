"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { HardDrive, Loader2 } from "lucide-react";

import {
  labDisksAction,
  proposeRemoveLabAction,
  type LabDisksView,
} from "@/app/dashboard/learning/lab-actions";
import { announceActionsChanged } from "@/components/os/pending-actions";
import { Button } from "@/components/ui/button";
import { formatBytes, IDLE_DAYS, type LabDiskView } from "@/lib/lab/disks";

const WHY: Record<NonNullable<LabDiskView["suggestRemoval"]>, string> = {
  finished: "Project finished",
  dropped: "Project dropped",
  orphaned: "Not part of any project",
  idle: `Unused for ${IDLE_DAYS}+ days`,
};

/**
 * What every lab takes on this computer, and a way to get the space back. Sizes are measured
 * when the page opens, not polled — each one is a short read of the lab's disk.
 */
export function LabDisks() {
  const [view, setView] = useState<LabDisksView | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const load = useCallback(async () => {
    const result = await labDisksAction();
    if (result.ok && result.view) setView(result.view);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!view) {
    return (
      <p className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Measuring lab disks…
      </p>
    );
  }
  if (view.labs.length === 0 && view.bases.length === 0) return null;

  const reclaimable = view.labs
    .filter((lab) => lab.suggestRemoval)
    .reduce((sum, lab) => sum + (lab.bytes ?? 0), 0);

  return (
    <div className="border-t border-border/60">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-xs text-muted-foreground">
        <HardDrive className="size-3.5" aria-hidden="true" />
        <span>
          Labs use{" "}
          <span className="font-medium text-foreground">{formatBytes(view.totalBytes)}</span> on
          this computer
          {reclaimable > 0 ? (
            <>
              {" "}
              · <span className="font-medium text-foreground">{formatBytes(reclaimable)}</span> is
              in labs you are done with
            </>
          ) : null}
          . Images stay either way, so nothing is downloaded again.
        </span>
      </div>
      <ul className="divide-y divide-border/60">
        {view.bases.map((base) => (
          <li key={base.template} className="flex items-center gap-3 px-4 py-2.5">
            <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">Saved {base.label} base</span>
              <span className="block truncate text-xs text-muted-foreground">
                New {base.label} labs start from this copy — no download, no install
              </span>
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatBytes(base.bytes)}
            </span>
          </li>
        ))}
        {view.labs.map((lab) => (
          <li key={lab.name} className="flex items-center gap-3 px-4 py-2.5">
            <span
              className={`size-2 shrink-0 rounded-full ${
                lab.running
                  ? "bg-success"
                  : lab.suggestRemoval
                    ? "bg-warning"
                    : "bg-muted-foreground/40"
              }`}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">
                {lab.projectTitle ?? <span className="font-mono">fadi-{lab.name}</span>}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {lab.running
                  ? "Running"
                  : lab.suggestRemoval
                    ? WHY[lab.suggestRemoval]
                    : lab.idleDays !== null
                      ? `Stopped · last used ${lab.idleDays === 0 ? "today" : `${lab.idleDays} days ago`}`
                      : "Stopped"}
              </span>
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatBytes(lab.bytes)}
            </span>
            <Button
              size="sm"
              variant={lab.suggestRemoval ? "outline" : "ghost"}
              disabled={busy || lab.blocked === "running"}
              title={lab.blocked === "running" ? "Pause the lab first" : undefined}
              onClick={() =>
                start(async () => {
                  const result = await proposeRemoveLabAction({ name: lab.name });
                  setNote(result.message ?? null);
                  if (result.ok) announceActionsChanged();
                  await load();
                })
              }
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      {note ? <p className="px-4 py-2 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
