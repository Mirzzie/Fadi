"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, MonitorCog, Trash2 } from "lucide-react";

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
  vm: "VMware guest",
  sbc: "Single-board computer",
  microcontroller: "Microcontroller",
  cloud: "Cloud host",
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

  // An empty list says nothing: "This computer" is always shown above it.
  if (resources.length === 0) return null;

  return (
    <div className="space-y-2">
      {resources.map((resource) => (
        <article
          key={resource.id}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
        >
          <MonitorCog className="size-5 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{resource.label}</p>
            <p className="text-xs text-muted-foreground">
              {[
                kindLabel[resource.kind] ?? resource.kind,
                resource.memoryMb != null ? memoryLabel(resource.memoryMb) : null,
                resource.endpointKind === "vmware" ? "VMware" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {confirmingId === resource.id ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmingId(null)}>
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
          ) : (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Remove ${resource.label}`}
              disabled={pending}
              onClick={() => setConfirmingId(resource.id)}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </article>
      ))}
      {message ? <p className="text-xs text-destructive">{message}</p> : null}
    </div>
  );
}
