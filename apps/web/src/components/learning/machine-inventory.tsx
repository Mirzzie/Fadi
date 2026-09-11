"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Cpu, HardDrive, Loader2, MemoryStick, MonitorCog, Power, Trash2 } from "lucide-react";

import {
  listLabResources,
  removeLabResource,
  type LabResourceView,
} from "@/app/dashboard/learning/lab-actions";
import { Button } from "@/components/ui/button";

const kindLabel: Record<string, string> = {
  laptop: "Laptop",
  server: "Server",
  hypervisor: "Hypervisor",
  sbc: "Single-board computer",
  microcontroller: "Microcontroller",
  cloud: "Cloud host",
};

const virtualizationLabel: Record<string, string> = {
  none: "No container or VM runtime recorded",
  containers: "Containers recorded",
  vms: "Virtual machines recorded",
  nested: "Nested virtualisation recorded",
};

function memoryLabel(memoryMb: number | null) {
  if (memoryMb == null) return "RAM unknown";
  return `${Math.round((memoryMb / 1024) * 10) / 10} GB RAM`;
}

export function MachineInventory() {
  const [resources, setResources] = useState<LabResourceView[] | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const result = await listLabResources();
      if (result.ok) setResources(result.resources);
    });
  }, []);

  useEffect(() => {
    refresh();
    const onChanged = () => refresh();
    window.addEventListener("fadi:resources-changed", onChanged);
    return () => window.removeEventListener("fadi:resources-changed", onChanged);
  }, [refresh]);

  if (!resources) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading machines…
      </p>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
        <MonitorCog className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-3 font-semibold">No machines registered</h2>
        <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
          A machine appears here after you detect or describe one from a project plan. Registration
          records capacity and placement; it does not give Fadi control by itself.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {resources.map((resource) => (
        <article
          key={resource.id}
          className="rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <header className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <MonitorCog className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold">{resource.label}</h2>
              <p className="text-xs text-muted-foreground">
                {kindLabel[resource.kind] ?? resource.kind} · {resource.arch}
              </p>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Remove ${resource.label}`}
              disabled={pending}
              onClick={() => setConfirmingId(resource.id)}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          </header>

          {confirmingId === resource.id ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
              <p className="mr-auto text-xs text-muted-foreground">
                Remove this machine from Fadi&apos;s inventory?
              </p>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setConfirmingId(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await removeLabResource(resource.id);
                    if (!result.ok) {
                      setMessage(`Could not remove ${resource.label}.`);
                      return;
                    }
                    setConfirmingId(null);
                    setMessage(null);
                    window.dispatchEvent(new CustomEvent("fadi:resources-changed"));
                    refresh();
                  })
                }
              >
                Remove
              </Button>
            </div>
          ) : null}

          <dl className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div className="flex items-center gap-1.5">
              <MemoryStick className="size-3.5" aria-hidden="true" />
              <span>{memoryLabel(resource.memoryMb)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HardDrive className="size-3.5" aria-hidden="true" />
              <span>
                {resource.diskGb == null ? "Free disk unknown" : `${resource.diskGb} GB free`}
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:col-span-2">
              <Cpu className="size-3.5" aria-hidden="true" />
              <span>{virtualizationLabel[resource.virtualization] ?? resource.virtualization}</span>
            </div>
            <div className="flex items-center gap-1.5 sm:col-span-2">
              <Power className="size-3.5" aria-hidden="true" />
              <span>
                {resource.alwaysOn ? "Recorded as always on" : "Availability not guaranteed"}
              </span>
            </div>
          </dl>

          <div className="mt-4 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            Runtime state unknown · no health check attached
          </div>
        </article>
      ))}
      {message ? <p className="text-xs text-destructive md:col-span-2">{message}</p> : null}
    </div>
  );
}
