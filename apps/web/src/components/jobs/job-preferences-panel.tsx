"use client";

import { useState, useTransition } from "react";
import { Check, Moon, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { saveJobPreferences } from "@/app/dashboard/jobs/actions";

/**
 * Background auto-search. One meaning, no duplicate controls: the live search bar
 * below is the single source of truth for location + mode + type; this panel only
 * toggles the background agent and saves those current filters as what it runs with.
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
      // Always scope to the user's filters — the "anywhere" toggle is gone; broaden
      // by clearing the city / picking "Any country" in the search bar instead.
      await saveJobPreferences({ modes: activeModes, types: activeTypes, autoSearch, agentScope: "filters" });
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
            Fadi keeps searching with the filters below (
            <span className="text-foreground">{filterSummary}</span>, in your search area) and brings new
            roles to your board — it never auto-applies on your behalf.
          </span>
        </span>
      </label>

      <Button size="sm" onClick={save} disabled={pending}>
        <Check className="size-4" aria-hidden="true" />
        {saved ? "Saved" : pending ? "Saving…" : "Save background-search settings"}
      </Button>
    </section>
  );
}
