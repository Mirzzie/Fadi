"use client";

import { Check, Container, Loader2, Monitor } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";

import {
  placeOnFreshLabAction,
  placeOnVmwareAction,
  vmwareChoicesAction,
  type VmwareChoices,
} from "@/app/dashboard/learning/vmware-actions";
import { formatMemory } from "@/lib/lab/sizes";

/**
 * WHERE THIS PROJECT RUNS — one click.
 *
 * Laid out as cards, not a dropdown: the fitting VMware machines are the first thing seen, and
 * "Fresh lab on this computer" sits beside them. Choosing places the project; starting is its
 * own approval in the lab panel.
 */
export function MachineChooser({
  runId,
  onkind,
  onChanged,
}: {
  runId: string;
  /** Where the project runs now. */
  onkind: "local-docker" | "vmware" | "unconnected";
  onChanged: (message: string) => void;
}) {
  const [choices, setChoices] = useState<VmwareChoices | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = useCallback(
    () =>
      vmwareChoicesAction({ runId }).then((result) =>
        setChoices(result.ok ? result.choices : null)
      ),
    [runId]
  );

  useEffect(() => {
    let alive = true;
    void vmwareChoicesAction({ runId }).then((result) => {
      if (alive) setChoices(result.ok ? result.choices : null);
    });
    return () => {
      alive = false;
    };
  }, [runId]);

  if (!choices || !choices.vmwareInstalled || choices.machines.length === 0) return null;
  const fitting = choices.machines.filter((m) => m.fits || m.current);
  const others = choices.machines.filter((m) => !m.fits && !m.current);
  const shown = showAll ? [...fitting, ...others] : fitting;

  const choose = (action: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => {
      const result = await action();
      onChanged(result.message);
      await load();
    });

  return (
    <div className="border-b border-border/70 px-4 py-3">
      <p className="mb-2 text-xs text-muted-foreground">
        Runs on{choices.needs ? ` — this project needs ${choices.needs}` : ""}
      </p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <button
          type="button"
          disabled={pending || onkind === "local-docker"}
          onClick={() => choose(() => placeOnFreshLabAction({ runId }))}
          className={card(onkind === "local-docker")}
        >
          <Container className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-medium">Fresh lab on this computer</span>
            <span className="block text-xs text-muted-foreground">
              Fadi&apos;s own copy, removed when you finish
            </span>
          </span>
          {onkind === "local-docker" ? (
            <Check className="size-4 text-primary" aria-hidden="true" />
          ) : null}
        </button>
        {shown.map((machine) => (
          <button
            key={machine.vmxPath}
            type="button"
            disabled={pending || machine.current}
            onClick={() => choose(() => placeOnVmwareAction({ runId, vmxPath: machine.vmxPath }))}
            className={card(machine.current)}
          >
            <Monitor className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium">{machine.name}</span>
              <span className="block text-xs text-muted-foreground">
                Your VMware machine
                {machine.memoryMb ? ` · ${formatMemory(machine.memoryMb)}` : ""}
                {machine.running ? " · running" : ""}
              </span>
            </span>
            {machine.current ? (
              <Check className="size-4 text-primary" aria-hidden="true" />
            ) : pending ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
            ) : null}
          </button>
        ))}
      </div>
      {others.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="mt-2 text-xs text-muted-foreground hover:text-foreground"
        >
          {showAll ? "Show only machines that fit" : `Other machines (${others.length})`}
        </button>
      ) : null}
    </div>
  );
}

function card(selected: boolean): string {
  return `flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors disabled:cursor-default ${
    selected
      ? "border-primary/60 bg-primary/5"
      : "border-border hover:border-primary/40 hover:bg-muted/40"
  }`;
}
