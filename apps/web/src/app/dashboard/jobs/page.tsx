import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { JobsShell } from "@/components/jobs/jobs-shell";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDashboardProfileSummary } from "@/lib/career-report/data";
import { getJobSourceCoverage } from "@/lib/data-sources/service";
import { getRecommendedJobsForUser } from "@/lib/jobs/data";
import type { EmploymentType, VisaFilter, WorkMode } from "@/lib/jobs/filters";
import { getCountry, parseLocation } from "@/lib/jobs/locations";
import { getOnboardingStatus } from "@/lib/onboarding/status";

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

  const onboardingStatus = await getOnboardingStatus(user.id);
  if (onboardingStatus !== "completed") redirect("/onboarding");

  const params = await searchParams;
  const profile = await getDashboardProfileSummary(user.id);

  const fromProfile = parseLocation(profile?.locationPreference);
  const country = (params.country ?? fromProfile.country)?.toLowerCase();
  const city = params.city?.trim() || fromProfile.city;
  const modes = parseList(params.modes, MODES);
  const types = parseList(params.types, TYPES);
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
