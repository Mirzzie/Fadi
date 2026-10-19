import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createProfilesRepository } from "@careeros/database";

import { AppShell } from "@/components/layout/app-shell";
import { UnifiedJobSearch } from "@/components/jobs/unified-job-search";
import { JobsShell } from "@/components/jobs/jobs-shell";
import { JobControlBar } from "@/components/jobs/job-control-bar";
import { JobSearchProgress } from "@/components/jobs/job-search-progress";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDashboardProfileSummary } from "@/lib/career-report/data";
import { getDatabase } from "@/lib/database/client";
import { getJobSourceCoverage, getJobSourcesHealth } from "@/lib/data-sources/service";
import { getJobSyncStatusForUser, getRecommendedJobsForUser } from "@/lib/jobs/data";
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
    /** Words from the search box, comma-separated. */
    q?: string;
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
  // A DETECTED location must never outrank the one the person stated. The owner's saved default
  // was {country: "us", precise: false} — auto-detected — while their profile says Ireland, so
  // opening Jobs searched the United States and found nothing. An explicitly chosen saved
  // location (precise) still wins over the profile region.
  const saved = prefs.location;
  const savedLoc = saved?.precise === false && fromProfile.country ? undefined : saved;
  // "any" = the user explicitly chose "Any country": search worldwide and don't
  // fall back to a default (that fallback is why only Ireland showed).
  const worldwide = params.country === "any";
  const country = worldwide
    ? undefined
    : (params.country ?? savedLoc?.country ?? fromProfile.country)?.toLowerCase();
  const city = worldwide ? undefined : params.city?.trim() || savedLoc?.city || fromProfile.city;
  // Saved preferences are the defaults; an explicit URL filter overrides them.
  const modes = parseList(params.modes ?? (prefs.modes ?? []).join(","), MODES);
  const types = parseList(params.types ?? (prefs.types ?? []).join(","), TYPES);
  const visa: VisaFilter =
    params.visa === "sponsored" || params.visa === "none" ? params.visa : "any";
  // What the person typed. Carried in the URL so a refresh, a share or a back button repeats
  // the same search, and both search paths filter identically.
  const keywords = (params.q ?? "")
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 6);

  const jobs = await getRecommendedJobsForUser(user.id, undefined, {
    country,
    city,
    worldwide,
    modes,
    types,
    visa,
    keywords,
  });

  // Live crawl status (getRecommendedJobsForUser just kicked off the background run) — drives
  // the "searching the web…" banner that auto-refreshes the board until results land.
  const syncStatus = await getJobSyncStatusForUser(user.id, { country, city, worldwide });

  // Honest, domain-agnostic: if the live sources don't cover this user's field,
  // say so (and how to fix it) rather than showing tech noise or a blank list.
  const coverage = getJobSourceCoverage(profile?.domain);
  // Source health reflects THIS request's live pull (computed during the sync above).
  const sourcesHealth = getJobSourcesHealth();

  return (
    <AppShell>
      <div className="mx-auto mb-10 max-w-shell border-b border-border/70 pb-8 pt-3">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Opportunities
        </p>
        <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">
          Find work worth pursuing.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          Search the live market in plain language. Fadi ranks what comes back against the evidence
          already in your career record.
        </p>
        <div className="mt-8 space-y-3">
        <UnifiedJobSearch
          activeRole={profile?.targetRole ?? null}
          selectedCountry={worldwide ? "any" : (getCountry(country)?.code ?? null)}
          selectedCity={city ?? null}
          selectedModes={modes}
          selectedTypes={types}
          selectedVisa={visa}
          selectedKeywords={keywords}
        />
        <JobSearchProgress status={syncStatus} />
        <details className="border-t border-border/70">
          <summary className="cursor-pointer py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
            Search details
          </summary>
          <div className="border-t border-border/60 pt-3">
            <JobControlBar
              sources={sourcesHealth.sources}
              // What each source actually put in front of them, after matching and filtering. A
              // source's own pull count answers "did the API reply"; this answers "did it help".
              onBoard={jobs.reduce<Record<string, number>>((counts, job) => {
                for (const source of job.sources) counts[source] = (counts[source] ?? 0) + 1;
                return counts;
              }, {})}
              lastRunAt={sourcesHealth.lastRunAt}
              activeModes={modes}
              activeTypes={types}
              autoSearch={Boolean(prefs.autoSearch)}
            />
          </div>
        </details>
        </div>
      </div>
      <JobsShell
        observedAt={
          // When this scope's last run finished; failing that, the freshest posting we hold.
          syncStatus?.finishedAt ??
          (jobs.length > 0
            ? Math.max(...jobs.map((job) => new Date(job.firstSeenAt).getTime()))
            : null)
        }
        searchOutcome={{
          keywords,
          failed: sourcesHealth.sources
            .filter((s) => s.lastRun?.status === "error")
            .map((s) => s.name),
          noCoverage: sourcesHealth.sources
            .filter((s) => s.lastRun?.status === "unsupported_here")
            .map((s) => s.name),
          returning: sourcesHealth.sources.filter((s) => (s.lastRun?.count ?? 0) > 0).length,
        }}
        jobs={jobs}
        activeRole={profile?.targetRole ?? null}
        selectedCountry={worldwide ? "any" : (getCountry(country)?.code ?? null)}
        selectedCity={city ?? null}
        coverageNotice={coverage.message}
      />
    </AppShell>
  );
}
