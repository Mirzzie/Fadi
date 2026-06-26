"use client";

import { useState, useTransition } from "react";
import { Check, Moon, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveJobPreferences } from "@/app/dashboard/jobs/actions";

const MODES = ["remote", "hybrid", "onsite"] as const;
const TYPES = ["full-time", "part-time", "contract", "freelance"] as const;

type Prefs = { modes: string[]; types: string[]; autoSearch: boolean };

export function JobPreferencesPanel({ initial }: { initial: Prefs }) {
  const [open, setOpen] = useState(false);
  const [modes, setModes] = useState<string[]>(initial.modes);
  const [types, setTypes] = useState<string[]>(initial.types);
  const [autoSearch, setAutoSearch] = useState(initial.autoSearch);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function save() {
    startTransition(async () => {
      await saveJobPreferences({ modes, types, autoSearch });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  const summary = [
    modes.length ? modes.join("/") : "any mode",
    types.length ? types.join("/") : "any type",
    autoSearch ? "auto-search on" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="rounded-xl border bg-card p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
          Job search preferences
        </span>
        <span className="text-xs text-muted-foreground">{summary}</span>
      </button>

      {open ? (
        <div className="mt-4 space-y-4">
          <Group label="Work mode" options={[...MODES]} selected={modes} onToggle={(v) => toggle(modes, setModes, v)} />
          <Group label="Employment type" options={[...TYPES]} selected={types} onToggle={(v) => toggle(types, setTypes, v)} />

          <label className="flex items-start gap-2.5 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={autoSearch}
              onChange={(e) => setAutoSearch(e.target.checked)}
              className="mt-0.5 size-4"
            />
            <span>
              <span className="flex items-center gap-1.5 font-medium">
                <Moon className="size-3.5 text-primary" aria-hidden="true" /> Auto-search while I&apos;m away
              </span>
              <span className="text-xs text-muted-foreground">
                Fadi&apos;s background agent surfaces new roles matching these preferences and brings
                them to you. It <span className="text-foreground">finds and shows</span> jobs — it
                never auto-applies on your behalf.
              </span>
            </span>
          </label>

          <Button size="sm" onClick={save} disabled={pending}>
            <Check className="size-4" aria-hidden="true" />
            {saved ? "Saved" : pending ? "Saving…" : "Save preferences"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function Group({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs capitalize transition-colors",
              selected.includes(o)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
