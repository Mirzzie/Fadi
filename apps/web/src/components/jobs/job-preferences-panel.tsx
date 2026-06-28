"use client";

import { useState, useTransition } from "react";
import { Check, Moon, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { saveJobPreferences } from "@/app/dashboard/jobs/actions";

/**
 * Background auto-search. Deliberately does NOT re-list work-mode / employment-type
 * chips — those live in the live search bar below (the single source of truth, which
 * already defaults from these saved prefs). This panel's only job is the one thing the
 * search bar can't do: toggle Fadi's background agent and persist the CURRENT filters
 * as what it searches with. No duplicate controls.
 */
export function JobPreferencesPanel({
  activeModes,
  activeTypes,
  autoSearch: initialAutoSearch,
}: {
  activeModes: string[];
  activeTypes: string[];
  autoSearch: boolean;
}) {
  const [autoSearch, setAutoSearch] = useState(initialAutoSearch);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const filterSummary = [
    activeModes.length ? activeModes.join("/") : "any mode",
    activeTypes.length ? activeTypes.join("/") : "any type",
  ].join(" · ");

  function save() {
    startTransition(async () => {
      await saveJobPreferences({ modes: activeModes, types: activeTypes, autoSearch });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
        Background job search
      </div>

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
            Fadi&apos;s background agent keeps searching with your current filters (
            <span className="text-foreground">{filterSummary}</span>) and brings new roles to you. It{" "}
            <span className="text-foreground">finds and shows</span> jobs — it never auto-applies on your
            behalf. Set the filters in the search below; this saves them for the background run.
          </span>
        </span>
      </label>

      <Button size="sm" onClick={save} disabled={pending}>
        <Check className="size-4" aria-hidden="true" />
        {saved ? "Saved" : pending ? "Saving…" : "Save current filters for auto-search"}
      </Button>
    </section>
  );
}
