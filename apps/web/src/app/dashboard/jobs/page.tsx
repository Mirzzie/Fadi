import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createProfilesRepository } from "@careeros/database";

import { AppShell } from "@/components/layout/app-shell";
import { AiJobSearchBar } from "@/components/jobs/ai-job-search-bar";
import { JobsShell } from "@/components/jobs/jobs-shell";
import { JobPreferencesPanel } from "@/components/jobs/job-preferences-panel";
import { JobSourcesStatus } from "@/components/jobs/job-sources-status";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDashboardProfileSummary } from "@/lib/career-report/data";
import { getDatabase } from "@/lib/database/client";
import { getJobSourceCoverage, getJobSourcesHealth } from "@/lib/data-sources/service";
import { getRecommendedJobsForUser } from "@/lib/jobs/data";
import type { EmploymentType, VisaFilter, WorkMode } from "@/lib/jobs/filters";
import { getCountry, parseLocation } from "@/lib/jobs/locations";
import { onboardingStatusOf } from "@/lib/onboarding/status";

export const metadata: Metadata = {
  title: "Jobs",
};

export const dynamic = "force-dynamic";

const MODES: WorkMode[] = ["remote", "hybrid", "onsite"];
const TYPES: EmploymentType[] = ["full-time", "part-time", "contract", "freelance"];

function parseList<T extends string>(value: string | undefined, allowed: readonly T[]): T[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v): v is T => (allowed as readonly string[]).includes(v));
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{
    country?: string;
    city?: string;
    modes?: string;
    types?: string;
    visa?: string;
  }>;
}) {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in?next=/dashboard/jobs");

  const params = await searchParams;
  const db = getDatabase();
  const [profile, profileRow] = await Promise.all([
    getDashboardProfileSummary(user.id),
    createProfilesRepository(db).getByUserId(user.id),
  ]);

  // Gate on the profiles row we already loaded — no separate onboarding round-trip.
  if (onboardingStatusOf(profileRow) !== "completed") redirect("/onboarding");

  const prefs = profileRow?.jobPreferences ?? {};

  // Default search location: an explicit URL filter wins; then the user's saved
  // default (e.g. from private browser-region detection); then their profile region.
  const fromProfile = parseLocation(profile?.locationPreference);
  const savedLoc = prefs.location;
  // "any" = the user explicitly chose "Any country": search worldwide and don't
  // fall back to a default (that fallback is why only Ireland showed).
  const worldwide = params.country === "any";
  const country = worldwide
    ? undefined
    : (params.country ?? savedLoc?.country ?? fromProfile.country)?.toLowerCase();
  const city = worldwide ? undefined : (params.city?.trim() || savedLoc?.city || fromProfile.city);
  // Saved preferences are the defaults; an explicit URL filter overrides them.
  const modes = parseList(params.modes ?? (prefs.modes ?? []).join(","), MODES);
  const types = parseList(params.types ?? (prefs.types ?? []).join(","), TYPES);
  const visa: VisaFilter =
    params.visa === "sponsored" || params.visa === "none" ? params.visa : "any";

  const jobs = await getRecommendedJobsForUser(user.id, undefined, {
    country,
    city,
    worldwide,
    modes,
    types,
    visa,
  });

  // Honest, domain-agnostic: if the live sources don't cover this user's field,
  // say so (and how to fix it) rather than showing tech noise or a blank list.
  const coverage = getJobSourceCoverage(profile?.domain);
  // Source health reflects THIS request's live pull (computed during the sync above).
  const sourcesHealth = getJobSourcesHealth();

  return (
    <AppShell>
      <div className="mx-auto mb-4 max-w-shell space-y-4">
        <AiJobSearchBar activeRole={profile?.targetRole ?? null} />
        <JobPreferencesPanel
          activeModes={modes}
          activeTypes={types}
          autoSearch={Boolean(prefs.autoSearch)}
        />
        <JobSourcesStatus sources={sourcesHealth.sources} lastRunAt={sourcesHealth.lastRunAt} />
      </div>
      <JobsShell
        jobs={jobs}
        activeRole={profile?.targetRole ?? null}
        selectedCountry={worldwide ? "any" : (getCountry(country)?.code ?? null)}
        selectedCity={city ?? null}
        selectedModes={modes}
        selectedTypes={types}
        selectedVisa={visa}
        coverageNotice={coverage.message}
      />
    </AppShell>
  );
}
