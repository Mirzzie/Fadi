"use client";

import { ChevronDown, Cpu } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  machineSettingsAction,
  proposeMachineChangeAction,
  type MachineSettingsView,
} from "@/app/dashboard/learning/machine-settings-actions";

/**
 * MACHINE SETTINGS — CPU, memory, network and screen of the person's own VMware machine, as
 * option buttons (no dropdowns). Changes are made while the machine is off, in one approval,
 * with the old settings file kept.
 */

const CPUS = [1, 2, 4, 6, 8];
const MEMORY = [2048, 3072, 4096, 6144, 8192];
const NETWORK = [
  { value: "nat", label: "NAT", hint: "internet + this computer" },
  { value: "hostonly", label: "Host-only", hint: "this computer only, no internet" },
];
const SCREEN = [
  { value: "auto", label: "Auto" },
  { value: "1600x900", label: "1600×900" },
  { value: "1920x1080", label: "1920×1080" },
];

type Draft = { cpus?: number; memoryMb?: number; network?: string; screen?: string };

export function MachineSettings({
  runId,
  tick,
  onProposed,
}: {
  runId: string;
  tick: number;
  onProposed: (message: string) => void;
}) {
  const [machine, setMachine] = useState<MachineSettingsView | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    void machineSettingsAction({ runId }).then((result) => {
      if (alive) setMachine(result.ok ? result.machine : null);
    });
    return () => {
      alive = false;
    };
  }, [runId, Math.floor(tick / 2)]); // eslint-disable-line react-hooks/exhaustive-deps

  const changes = useMemo(() => {
    if (!machine) return {};
    const current = machine.settings;
    return Object.fromEntries(
      Object.entries(draft).filter(
        ([key, value]) => value !== undefined && value !== current[key as keyof typeof current]
      )
    ) as Draft;
  }, [draft, machine]);

  if (!machine) return null;
  const now = { ...machine.settings, ...draft };
  const changed = Object.keys(changes).length > 0;

  const propose = (kind: "configure" | "shutdown") =>
    startTransition(async () => {
      const result = await proposeMachineChangeAction({
        runId,
        kind,
        changes: kind === "configure" ? changes : undefined,
      });
      onProposed(result.message);
      if (result.ok && kind === "configure") setDraft({});
    });

  const chip = (selected: boolean, disabled = false) =>
    `rounded-lg border px-2.5 py-1 text-xs transition-colors ${
      selected
        ? "border-primary/60 bg-primary/10 text-foreground"
        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
    } ${disabled ? "cursor-not-allowed opacity-40" : ""}`;

  return (
    <div className="border-b border-border/70">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs"
      >
        <Cpu className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1 text-muted-foreground">
          Machine settings · {machine.settings.cpus} CPU ·{" "}
          {machine.settings.memoryMb ? `${Math.round(machine.settings.memoryMb / 1024)} GB` : "?"} ·{" "}
          {machine.settings.network === "hostonly"
            ? "host-only"
            : (machine.settings.network ?? "?")}
          {machine.settings.screen !== "auto"
            ? ` · ${machine.settings.screen.replace("x", "×")}`
            : ""}
        </span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="space-y-3 px-4 pb-4 text-xs">
          <Row label="CPU cores" hint={`this computer has ${machine.hostCpus}`}>
            {CPUS.map((value) => (
              <button
                key={value}
                type="button"
                disabled={value > machine.hostCpus}
                onClick={() => setDraft((d) => ({ ...d, cpus: value }))}
                className={chip(now.cpus === value, value > machine.hostCpus)}
              >
                {value}
              </button>
            ))}
          </Row>
          <Row
            label="Memory"
            hint={`${Math.round((machine.hostFreeMb / 1024) * 10) / 10} GB free on this computer`}
          >
            {MEMORY.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, memoryMb: value }))}
                className={chip(
                  now.memoryMb === value ||
                    (draft.memoryMb === undefined &&
                      !MEMORY.includes(machine.settings.memoryMb ?? 0) &&
                      Math.abs((machine.settings.memoryMb ?? 0) - value) < 128)
                )}
              >
                {value / 1024} GB
              </button>
            ))}
          </Row>
          <Row label="Network" hint="Fadi's services listen on the NAT network">
            {NETWORK.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, network: option.value }))}
                className={chip(now.network === option.value)}
                title={option.hint}
              >
                {option.label} <span className="text-muted-foreground">· {option.hint}</span>
              </button>
            ))}
          </Row>
          <Row label="Screen" hint="largest size Windows may pick">
            {SCREEN.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, screen: option.value }))}
                className={chip(now.screen === option.value)}
              >
                {option.label}
              </button>
            ))}
          </Row>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {machine.running ? (
              <>
                <span className="text-muted-foreground">
                  The machine is running. These change only while it is shut down.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={pending}
                  onClick={() => propose("shutdown")}
                >
                  Shut it down
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="h-7"
                disabled={pending || !changed}
                onClick={() => propose("configure")}
              >
                Apply{" "}
                {changed
                  ? `${Object.keys(changes).length} change${Object.keys(changes).length === 1 ? "" : "s"}`
                  : ""}
              </Button>
            )}
            {changed ? (
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setDraft({})}>
                Reset
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-muted-foreground">
        {label} <span className="opacity-70">— {hint}</span>
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
