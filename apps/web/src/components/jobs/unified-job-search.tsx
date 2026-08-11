"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, Search, SlidersHorizontal } from "lucide-react";

import { resolveSearch } from "@/app/dashboard/jobs/actions";
import { JobLocationFilter } from "@/components/jobs/job-location-filter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EmploymentType, VisaFilter, WorkMode } from "@/lib/jobs/filters";

// THE search. One plain-language box → Fadi reads the location/mode from your words and pulls
// the board fresh for the right place (role stays your active direction). Dropdowns live behind
// a "Filters" disclosure for precision — no competing search surfaces.
export function UnifiedJobSearch({
  activeRole,
  selectedCountry,
  selectedCity,
  selectedModes,
  selectedTypes,
  selectedVisa,
}: {
  activeRole?: string | null;
  selectedCountry: string | null;
  selectedCity: string | null;
  selectedModes: WorkMode[];
  selectedTypes: EmploymentType[];
  selectedVisa: VisaFilter;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [worldwide, setWorldwide] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [pending, start] = useTransition();

  function run() {
    if (!prompt.trim()) return;
    start(async () => {
      const r = await resolveSearch(prompt);
      const p = new URLSearchParams();
      if (worldwide) p.set("country", "any");
      else if (r.country) p.set("country", r.country);
      if (!worldwide && r.city) p.set("city", r.city);
      if (r.remote) p.set("modes", "remote");
      router.push(`/dashboard/jobs${p.toString() ? `?${p}` : ""}`);
    });
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2">
        <Search className="size-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Search jobs</h3>
        {activeRole ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {worldwide ? "Global" : activeRole}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Say where and how you want to work — Fadi pulls it fresh and matches it to your direction.
        e.g. &ldquo;graduate IT support in Dublin, remote&rdquo;.
      </p>

      <div className="mt-3 flex gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
          placeholder="e.g. graduate IT support in Dublin, remote"
          aria-label="Search jobs in plain language"
        />
        <Button onClick={run} disabled={pending || !prompt.trim()}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {pending ? "Searching…" : "Search"}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={worldwide}
            onChange={(e) => setWorldwide(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          <Globe className="size-3.5" aria-hidden="true" />
          Search worldwide (ignore location)
        </label>
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          aria-expanded={showFilters}
        >
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          {showFilters ? "Hide filters" : "Filters"}
        </button>
      </div>

      {showFilters ? (
        <div className="mt-3 border-t pt-3">
          <JobLocationFilter
            selectedCountry={selectedCountry}
            selectedCity={selectedCity}
            selectedModes={selectedModes}
            selectedTypes={selectedTypes}
            selectedVisa={selectedVisa}
          />
        </div>
      ) : null}
    </div>
  );
}
