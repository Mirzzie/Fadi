"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { EmploymentType, VisaFilter, WorkMode } from "@/lib/jobs/filters";
import { cn } from "@/lib/utils";

// Refinement chips only — mode / type / visa. Location is owned by the search box, so this is
// NOT a second search: clicking a chip toggles that one filter and keeps the current location.

const MODE_LABELS: Record<WorkMode, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };
const TYPE_LABELS: Record<EmploymentType, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  freelance: "Freelance",
};

export function JobFilterChips({
  selectedCountry,
  selectedCity,
  selectedModes,
  selectedTypes,
  selectedVisa,
}: {
  selectedCountry: string | null;
  selectedCity: string | null;
  selectedModes: WorkMode[];
  selectedTypes: EmploymentType[];
  selectedVisa: VisaFilter;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function navigate(next: { modes?: WorkMode[]; types?: EmploymentType[]; visa?: VisaFilter }) {
    const params = new URLSearchParams();
    if (selectedCountry) params.set("country", selectedCountry);
    if (selectedCountry !== "any" && selectedCity) params.set("city", selectedCity);
    const modes = next.modes ?? selectedModes;
    const types = next.types ?? selectedTypes;
    const visa = next.visa ?? selectedVisa;
    if (modes.length) params.set("modes", modes.join(","));
    if (types.length) params.set("types", types.join(","));
    if (visa && visa !== "any") params.set("visa", visa);
    const qs = params.toString();
    start(() => router.push(qs ? `/dashboard/jobs?${qs}` : "/dashboard/jobs"));
  }

  const toggleMode = (m: WorkMode) =>
    navigate({ modes: selectedModes.includes(m) ? selectedModes.filter((x) => x !== m) : [...selectedModes, m] });
  const toggleType = (t: EmploymentType) =>
    navigate({ types: selectedTypes.includes(t) ? selectedTypes.filter((x) => x !== t) : [...selectedTypes, t] });
  const toggleVisa = () => navigate({ visa: selectedVisa === "sponsored" ? "any" : "sponsored" });

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", pending && "opacity-60")}>
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
      <Chip active={selectedVisa === "sponsored"} onClick={toggleVisa} title="Best-effort: inferred from the job description">
        Visa sponsored
      </Chip>
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
