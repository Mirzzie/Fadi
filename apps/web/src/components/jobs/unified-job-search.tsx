"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, Search, SlidersHorizontal } from "lucide-react";

import { resolveSearch } from "@/app/dashboard/jobs/actions";
import { ImportJobLink } from "@/components/jobs/import-job-link";
import { JobFilterChips } from "@/components/jobs/job-filter-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EmploymentType, VisaFilter, WorkMode } from "@/lib/jobs/filters";

// THE search — one plain-language box. Fadi reads location + mode from your words and pulls the
// board fresh for the right place (role stays your active direction). No competing controls:
// "worldwide" DERIVES from the active location (can't contradict it), and Filters are refinement
// chips only, not a second search.
export function UnifiedJobSearch({
  activeRole,
  selectedCountry,
  selectedCity,
  selectedModes,
  selectedTypes,
  selectedVisa,
  selectedKeywords = [],
}: {
  activeRole?: string | null;
  selectedCountry: string | null;
  selectedCity: string | null;
  selectedModes: WorkMode[];
  selectedTypes: EmploymentType[];
  selectedVisa: VisaFilter;
  /** The words from the last search — shown, and clearable. */
  selectedKeywords?: string[];
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [pending, start] = useTransition();

  // Single source of truth: worldwide is simply "the active country is Any". No separate toggle
  // state to drift out of sync with the shown location.
  const worldwide = selectedCountry === "any";

  function push(next: {
    country?: string | null;
    city?: string | null;
    modes?: WorkMode[];
    keywords?: string[];
  }) {
    const country = next.country === undefined ? selectedCountry : next.country;
    const city = next.city === undefined ? selectedCity : next.city;
    const modes = next.modes ?? selectedModes;
    const keywords = next.keywords ?? selectedKeywords;
    const p = new URLSearchParams();
    if (keywords.length) p.set("q", keywords.join(","));
    if (country && country !== null) p.set("country", country);
    if (country !== "any" && city) p.set("city", city);
    if (modes.length) p.set("modes", modes.join(","));
    if (selectedTypes.length) p.set("types", selectedTypes.join(","));
    if (selectedVisa && selectedVisa !== "any") p.set("visa", selectedVisa);
    const qs = p.toString();
    start(() => router.push(qs ? `/dashboard/jobs?${qs}` : "/dashboard/jobs"));
  }

  function run() {
    if (!prompt.trim()) return;
    start(async () => {
      const r = await resolveSearch(prompt);
      // Typing a place overrides worldwide; typing none keeps the current scope. The WORDS are
      // carried too — the board filters on them, instead of quietly searching the direction.
      push({
        country: r.country ?? (worldwide ? "any" : selectedCountry),
        city: r.city ?? (r.country ? null : selectedCity),
        modes: r.remote ? Array.from(new Set([...selectedModes, "remote" as WorkMode])) : selectedModes,
        keywords: r.keywords,
      });
    });
  }

  function toggleWorldwide() {
    if (worldwide) push({ country: null, city: null }); // back to a located search
    else push({ country: "any", city: null }); // go global
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Search className="size-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Search jobs</h3>
        {activeRole ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {worldwide ? "Worldwide" : activeRole}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Say where and how you want to work — Fadi pulls it fresh and matches it to your direction.
        e.g. &ldquo;graduate IT support in Dublin, remote&rdquo;.
      </p>

      <div className="mt-5 flex gap-2 border-b-2 border-foreground pb-2">
        <Input
          className="h-12 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
          placeholder="e.g. graduate IT support in Dublin, remote"
          aria-label="Search jobs in plain language"
        />
        <Button className="h-11 rounded-md px-5" onClick={run} disabled={pending || !prompt.trim()}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {pending ? "Searching…" : "Search"}
        </Button>
      </div>

      {selectedKeywords.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Matching</span>
          {selectedKeywords.map((word) => (
            <span key={word} className="rounded-full bg-muted px-2 py-0.5 font-medium">
              {word}
            </span>
          ))}
          <button
            type="button"
            onClick={() => push({ keywords: [] })}
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear words
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={worldwide} onChange={toggleWorldwide} className="size-3.5 accent-primary" />
          <Globe className="size-3.5" aria-hidden="true" />
          Search worldwide
        </label>
        <span aria-hidden="true">·</span>
        <span>
          {worldwide ? "Anywhere" : selectedCity ? `${selectedCity}` : "your saved region"}
        </span>
        <ImportJobLink />
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          className="ml-auto flex items-center gap-1.5 hover:text-foreground"
          aria-expanded={showFilters}
        >
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          {showFilters ? "Hide filters" : "Filters"}
        </button>
      </div>

      {showFilters ? (
        <div className="mt-3 border-t pt-3">
          <JobFilterChips
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
