import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createProfilesRepository } from "@careeros/database";

import { AppShell } from "@/components/layout/app-shell";
import { JobsShell } from "@/components/jobs/jobs-shell";
import { JobPreferencesPanel } from "@/components/jobs/job-preferences-panel";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDashboardProfileSummary } from "@/lib/career-report/data";
import { getDatabase } from "@/lib/database/client";
import { getJobSourceCoverage } from "@/lib/data-sources/service";
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

  const fromProfile = parseLocation(profile?.locationPreference);
  const country = (params.country ?? fromProfile.country)?.toLowerCase();
  const city = params.city?.trim() || fromProfile.city;
  // Saved preferences are the defaults; an explicit URL filter overrides them.
  const modes = parseList(params.modes ?? (prefs.modes ?? []).join(","), MODES);
  const types = parseList(params.types ?? (prefs.types ?? []).join(","), TYPES);
  const visa: VisaFilter =
    params.visa === "sponsored" || params.visa === "none" ? params.visa : "any";

  const jobs = await getRecommendedJobsForUser(user.id, undefined, {
    country,
    city,
    modes,
    types,
    visa,
  });

  // Honest, domain-agnostic: if the live sources don't cover this user's field,
  // say so (and how to fix it) rather than showing tech noise or a blank list.
  const coverage = getJobSourceCoverage(profile?.domain);

  return (
    <AppShell>
      <div className="mx-auto mb-4 max-w-shell">
        <JobPreferencesPanel
          activeModes={modes}
          activeTypes={types}
          autoSearch={Boolean(prefs.autoSearch)}
        />
      </div>
      <JobsShell
        jobs={jobs}
        activeRole={profile?.targetRole ?? null}
        selectedCountry={getCountry(country)?.code ?? null}
        selectedCity={city ?? null}
        selectedModes={modes}
        selectedTypes={types}
        selectedVisa={visa}
        coverageNotice={coverage.message}
      />
    </AppShell>
  );
}
