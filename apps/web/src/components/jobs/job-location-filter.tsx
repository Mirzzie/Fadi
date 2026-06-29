"use client";

import { LocateFixed, MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveJobPreferences } from "@/app/dashboard/jobs/actions";
import type { EmploymentType, VisaFilter, WorkMode } from "@/lib/jobs/filters";
import { COUNTRIES } from "@/lib/jobs/locations";
import { cn } from "@/lib/utils";

type Props = {
  selectedCountry: string | null;
  selectedCity: string | null;
  selectedModes: WorkMode[];
  selectedTypes: EmploymentType[];
  selectedVisa: VisaFilter;
};

/** Country code from the browser locale (e.g. "en-IE" → "ie"). No coords, no network. */
function regionFromBrowser(): string | null {
  if (typeof navigator === "undefined") return null;
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const l of langs) {
    const code = /[-_]([A-Za-z]{2})(?:[-_]|$)/.exec(l ?? "")?.[1]?.toLowerCase();
    if (code && COUNTRIES.some((c) => c.code === code)) return code;
  }
  return null;
}

const MODE_LABELS: Record<WorkMode, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };
const TYPE_LABELS: Record<EmploymentType, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  freelance: "Freelance",
};

export function JobLocationFilter({
  selectedCountry,
  selectedCity,
  selectedModes,
  selectedTypes,
  selectedVisa,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [country, setCountry] = useState(selectedCountry ?? "any");
  const [city, setCity] = useState(selectedCity ?? "");
  const [geoError, setGeoError] = useState<string | null>(null);

  function navigate(next: {
    country?: string;
    city?: string;
    modes?: WorkMode[];
    types?: EmploymentType[];
    visa?: VisaFilter;
  }) {
    const params = new URLSearchParams();
    if (next.country) params.set("country", next.country);
    if (next.city?.trim()) params.set("city", next.city.trim());
    if (next.modes?.length) params.set("modes", next.modes.join(","));
    if (next.types?.length) params.set("types", next.types.join(","));
    if (next.visa && next.visa !== "any") params.set("visa", next.visa);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/dashboard/jobs?${qs}` : "/dashboard/jobs"));
  }

  const base = () => ({
    country,
    city,
    modes: selectedModes,
    types: selectedTypes,
    visa: selectedVisa,
  });

  // Privacy-first region detection: derives your country from the browser's own
  // locale/timezone — NO location permission, NO GPS coordinates, and nothing sent
  // to any third party. Sets it as your default search country; you type the city.
  function detectMyRegion() {
    setGeoError(null);
    const code = regionFromBrowser();
    if (!code) {
      setGeoError("Couldn't read your region from the browser — just pick a country or type your city.");
      return;
    }
    setCountry(code);
    void saveJobPreferences({ location: { country: code, precise: false } });
    navigate({ country: code, city, modes: selectedModes, types: selectedTypes, visa: selectedVisa });
  }

  function toggleMode(m: WorkMode) {
    const modes = selectedModes.includes(m)
      ? selectedModes.filter((x) => x !== m)
      : [...selectedModes, m];
    navigate({ ...base(), modes });
  }
  function toggleType(t: EmploymentType) {
    const types = selectedTypes.includes(t)
      ? selectedTypes.filter((x) => x !== t)
      : [...selectedTypes, t];
    navigate({ ...base(), types });
  }
  function toggleVisa() {
    navigate({ ...base(), visa: selectedVisa === "sponsored" ? "any" : "sponsored" });
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate(base());
        }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        aria-label="Filter jobs by location"
      >
        <select
          value={country}
          onChange={(e) => {
            const next = e.target.value;
            setCountry(next);
            // "Any country" is worldwide — a city would contradict it, so clear it.
            if (next === "any") setCity("");
            navigate({ ...base(), country: next, city: next === "any" ? "" : city });
          }}
          aria-label="Country"
          className={cn(
            "h-10 w-full rounded-md border border-input bg-background px-3 text-sm",
            "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "sm:w-52",
          )}
        >
          <option value="any">🌍 Any country (search worldwide)</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>

        <div className="relative flex-1">
          <MapPin
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City or area (e.g. Dublin)"
            aria-label="City or area"
            className="pl-9"
          />
        </div>

        <Button type="submit" disabled={isPending} className="shrink-0">
          <Search className="size-4" aria-hidden="true" />
          {isPending ? "Searching…" : "Search"}
        </Button>
      </form>

      {/* Region detection — fully private: locale only, no permission, no third party. */}
      <div className="space-y-1">
        <Button type="button" variant="outline" size="sm" onClick={detectMyRegion}>
          <LocateFixed className="size-3.5" aria-hidden="true" />
          Detect my region
        </Button>
        <p className="text-[0.7rem] leading-snug text-muted-foreground">
          Reads your country from your browser&apos;s language/region setting — no location permission, no
          GPS coordinates, nothing sent to anyone. Sets your default search country (and Fadi&apos;s
          background search); type the city yourself. Less precise than GPS, fully private.
        </p>
        {geoError ? <p className="text-xs text-amber-500">{geoError}</p> : null}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(Object.keys(MODE_LABELS) as WorkMode[]).map((m) => (
          <Chip key={m} active={selectedModes.includes(m)} onClick={() => toggleMode(m)}>
            {MODE_LABELS[m]}
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        {(Object.keys(TYPE_LABELS) as EmploymentType[]).map((t) => (
          <Chip key={t} active={selectedTypes.includes(t)} onClick={() => toggleType(t)}>
            {TYPE_LABELS[t]}
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        <Chip
          active={selectedVisa === "sponsored"}
          onClick={toggleVisa}
          title="Best-effort: inferred from the job description"
        >
          Visa sponsored
        </Chip>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
