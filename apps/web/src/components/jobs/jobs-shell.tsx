import { BriefcaseBusiness, CalendarClock, Info, Layers, MapPin, Signal, Wallet } from "lucide-react";

import { JobActions } from "@/components/jobs/job-actions";
import { JobDescription } from "@/components/jobs/job-description";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { matchAccent } from "@/lib/jobs/match-accent";
import type { RecommendedJob } from "@/lib/jobs/types";

type JobsShellProps = {
  jobs: RecommendedJob[];
  /** The active career direction these roles are matched to — shown for transparency. */
  activeRole?: string | null;
  selectedCountry: string | null;
  selectedCity: string | null;
  /** Honest advisory when the live sources don't cover the user's field. */
  coverageNotice?: string | null;
  /**
   * What the last pull actually did, so an empty board says which of four things happened:
   * nothing matched, the words were too narrow, sources failed, or no source covers this place.
   * Telling a person "no jobs" when a provider 404'd is the failure this exists to prevent.
   */
  /** When this list was last refreshed from the sources — null when nothing has run yet. */
  observedAt?: number | null;
  searchOutcome?: {
    keywords: string[];
    failed: string[];
    noCoverage: string[];
    returning: number;
  };
};

export function JobsShell({
  jobs,
  activeRole,
  selectedCountry,
  selectedCity,
  coverageNotice,
  observedAt,
  searchOutcome,
}: JobsShellProps) {
  return (
    <div className="mx-auto max-w-shell space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full opacity-[0.12] blur-3xl [background:var(--aurora-1)]"
        />
        <div className="relative space-y-5">
          <div className="max-w-3xl">
            <Badge variant="secondary">Live job discovery</Badge>
            <div className="mt-4 space-y-3">
              <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                Recommended{" "}
                <span className="bg-gradient-to-r from-primary to-[oklch(0.7_0.17_230)] bg-clip-text text-transparent">
                  jobs
                </span>
              </h2>
              <p className="text-muted-foreground">
                Live postings from the connected sources — Google for Jobs, Adzuna, Reed, Jooble,
                Remotive and more — matched to{" "}
                {activeRole ? (
                  <span className="text-foreground">your active direction: {activeRole}</span>
                ) : (
                  "your profile"
                )}
                . Each card links to the original posting so you can apply directly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CACHED RESULTS SAY SO. The board reads stored postings, which can be hours old; without
          a time on them, a stale list is indistinguishable from a fresh pull. */}
      {jobs.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {observedAt
            ? `These results were last refreshed ${agoLabel(observedAt)}. Search again to pull fresh postings.`
            : "These are stored results — nothing has been pulled from the sources in this session yet."}
        </p>
      ) : null}

      {coverageNotice ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
          <p className="text-foreground/90">{coverageNotice}</p>
        </div>
      ) : null}

      {jobs.length > 0 ? (
        <section className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader className="gap-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-[oklch(0.5_0.2_285)] font-heading text-base font-bold text-primary-foreground">
                      {job.company?.slice(0, 1)?.toUpperCase() ?? "?"}
                    </span>
                    <div className="space-y-1">
                      <CardTitle>{job.title}</CardTitle>
                      <CardDescription>{job.company}</CardDescription>
                    </div>
                  </div>
                  <div
                    style={matchAccent(job.matchScore).style}
                    className="shrink-0 rounded-md border border-dynamic bg-dynamic-soft px-3 py-2 text-sm font-medium tabular-nums text-dynamic"
                  >
                    {job.matchScore}% match
                  </div>
                </div>
                <JobMeta job={job} />
              </CardHeader>
              <CardContent className="space-y-4">
                <JobDescription text={job.description} />
                <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                  {job.matchReason}
                </div>
                {job.matchedKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {job.matchedKeywords.map((keyword) => (
                      <Badge key={`${job.id}-${keyword}`} variant="outline">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <JobActions
                  jobId={job.id}
                  isSaved={job.isSaved}
                  applicationStatus={job.applicationStatus}
                  url={job.url}
                />
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {searchOutcome?.keywords.length
                ? `Nothing matched “${searchOutcome.keywords.join(", ")}” here`
                : "No live jobs for this search"}
            </CardTitle>
            <CardDescription className="space-y-2">
              <span className="block">
                {searchOutcome?.keywords.length
                  ? "Clear the words above to see everything in this area, or search a different place."
                  : selectedCountry === "any"
                    ? "No postings came back worldwide for this role yet. Check back shortly as sources refresh, or set a specific country."
                    : selectedCity || selectedCountry
                      ? "No postings matched this location yet. Try a different city or country, or broaden to “Any country”."
                      : "No postings came back from the live sources yet. Add a country/city above, or check back shortly as sources refresh."}
              </span>
              {searchOutcome && searchOutcome.failed.length > 0 ? (
                <span className="block text-amber-500">
                  {searchOutcome.failed.length === 1
                    ? `${searchOutcome.failed[0]} failed on the last pull`
                    : `${searchOutcome.failed.length} sources failed on the last pull (${searchOutcome.failed.join(", ")})`}
                  , so this is not proof that there are no jobs. Search again to retry them.
                </span>
              ) : null}
              {searchOutcome && searchOutcome.noCoverage.length > 0 ? (
                <span className="block">
                  {searchOutcome.noCoverage.join(", ")} {searchOutcome.noCoverage.length === 1 ? "does" : "do"}{" "}
                  not cover this country at all — nothing was asked of{" "}
                  {searchOutcome.noCoverage.length === 1 ? "it" : "them"}.
                </span>
              ) : null}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

/** Honest posting age — the user is about to invest real time in this role,
 *  so they get to see how old (or undated) the posting is before they do. */
function postedAgo(postedAt: Date | null): string {
  if (!postedAt) return "Posting date not listed";
  const days = Math.floor((Date.now() - new Date(postedAt).getTime()) / 86_400_000);
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days < 30) return `Posted ${days} days ago`;
  return "Posted over a month ago — may be stale";
}

function JobMeta({ job }: { job: RecommendedJob }) {
  const items = [
    {
      label: job.location ?? "Location not listed",
      icon: MapPin,
    },
    {
      label: postedAgo(job.postedAt),
      icon: CalendarClock,
    },
    {
      label: [job.remoteMode, job.employmentType, job.seniority].filter(Boolean).join(" / "),
      icon: BriefcaseBusiness,
    },
    // Where it was listed. A vacancy grouped from two boards now says so, instead of looking
    // like a second posting the person has to compare by hand.
    ...(job.sources.length > 1
      ? [{ label: `Listed on ${sourceNames(job.sources)}`, icon: Layers }]
      : []),
    {
      label: job.salaryText ?? "Salary not listed",
      icon: Wallet,
    },
    {
      label: job.applicationStatus ? `Status: ${job.applicationStatus}` : "Not tracked yet",
      icon: Signal,
    },
  ].filter((item) => item.label);

  return (
    <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <item.icon className="size-4" aria-hidden="true" />
          <span className="capitalize">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Board names as a person would say them. */
function sourceNames(sources: string[]): string {
  const pretty: Record<string, string> = {
    adzuna: "Adzuna",
    arbeitnow: "Arbeitnow",
    apify_linkedin: "LinkedIn",
    "fadi-scraper:indeed": "Indeed",
    imported: "a link you added",
    jooble: "Jooble",
    jsearch: "Google for Jobs",
    reed: "Reed",
    remotive: "Remotive",
    themuse: "The Muse",
    "web-crawl": "the open web",
    "web-surfer": "a company page",
  };
  const names = sources.map((source) => pretty[source] ?? source);
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "4 minutes ago" — the observation time, never a promise about the posting itself. */
function agoLabel(at: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes === 1) return "a minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return "an hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
