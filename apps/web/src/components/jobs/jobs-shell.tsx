import { BriefcaseBusiness, CalendarClock, Info, MapPin, Signal, Wallet } from "lucide-react";

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
};

export function JobsShell({
  jobs,
  activeRole,
  selectedCountry,
  selectedCity,
  coverageNotice,
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
            <CardTitle>No live jobs for this search</CardTitle>
            <CardDescription>
              {selectedCountry === "any"
                ? "No postings came back worldwide for this role yet — the live sources are sparse for some fields/regions. Check back shortly as sources refresh, or set a specific country."
                : selectedCity || selectedCountry
                  ? "No postings matched this location yet. Try a different city or country, or broaden to “Any country”."
                  : "No postings came back from the live sources yet. Add a country/city above, or check back shortly as sources refresh."}
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
