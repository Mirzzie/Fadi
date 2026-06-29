"use client";

import { useState, useTransition } from "react";
import { Check, Globe, Moon, SlidersHorizontal, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveJobPreferences } from "@/app/dashboard/jobs/actions";

type AgentScope = "filters" | "broad";

/**
 * Background auto-search. Deliberately does NOT re-list work-mode / employment-type
 * chips — those live in the live search bar below (the single source of truth, which
 * already defaults from these saved prefs). This panel owns the things the search bar
 * can't: the background agent toggle, WHERE it searches (your filters vs anywhere),
 * and persisting the current filters as what it runs with.
 */
export function JobPreferencesPanel({
  activeModes,
  activeTypes,
  autoSearch: initialAutoSearch,
  agentScope: initialScope,
}: {
  activeModes: string[];
  activeTypes: string[];
  autoSearch: boolean;
  agentScope: AgentScope;
}) {
  const [autoSearch, setAutoSearch] = useState(initialAutoSearch);
  const [scope, setScope] = useState<AgentScope>(initialScope);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const filterSummary = [
    activeModes.length ? activeModes.join("/") : "any mode",
    activeTypes.length ? activeTypes.join("/") : "any type",
  ].join(" · ");

  function save() {
    startTransition(async () => {
      await saveJobPreferences({ modes: activeModes, types: activeTypes, autoSearch, agentScope: scope });
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
            Fadi&apos;s background agent keeps searching and brings new roles to you. It{" "}
            <span className="text-foreground">finds and shows</span> jobs — it never auto-applies on your
            behalf.
          </span>
        </span>
      </label>

      {/* Where the agent searches */}
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">Where Fadi searches in the background</span>
        <div className="grid grid-cols-2 gap-2">
          <ScopeOption
            active={scope === "filters"}
            onClick={() => setScope("filters")}
            icon={Target}
            title="My filters & location"
            blurb={`Only roles matching ${filterSummary} in your area — everything it finds is on your board.`}
          />
          <ScopeOption
            active={scope === "broad"}
            onClick={() => setScope("broad")}
            icon={Globe}
            title="Anywhere"
            blurb="On-role roles in any location — broader discovery; some won't match your current board filters."
          />
        </div>
      </div>

      <Button size="sm" onClick={save} disabled={pending}>
        <Check className="size-4" aria-hidden="true" />
        {saved ? "Saved" : pending ? "Saving…" : "Save background-search settings"}
      </Button>
    </section>
  );
}

function ScopeOption({
  active,
  onClick,
  icon: Icon,
  title,
  blurb,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Target;
  title: string;
  blurb: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border p-2.5 text-left transition-colors",
        active ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
      )}
    >
      <span className={cn("flex items-center gap-1.5 text-sm font-medium", active && "text-primary")}>
        <Icon className="size-3.5" aria-hidden="true" /> {title}
      </span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{blurb}</span>
    </button>
  );
}
