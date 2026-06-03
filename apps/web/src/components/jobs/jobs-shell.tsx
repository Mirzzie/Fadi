import { BriefcaseBusiness, MapPin, Signal, Wallet } from "lucide-react";

import { JobActions } from "@/components/jobs/job-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecommendedJob } from "@/lib/jobs/types";

type JobsShellProps = {
  jobs: RecommendedJob[];
};

export function JobsShell({ jobs }: JobsShellProps) {
  return (
    <div className="mx-auto max-w-shell space-y-6">
      <section className="rounded-lg border bg-card p-6">
        <Badge variant="secondary">Local job discovery</Badge>
        <div className="mt-4 max-w-3xl space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight">Recommended jobs</h2>
          <p className="text-muted-foreground">
            CareerOS is matching seeded local jobs against your onboarding profile. External job
            sources and AI ranking are intentionally not enabled yet.
          </p>
        </div>
      </section>

      {jobs.length > 0 ? (
        <section className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader className="gap-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <CardTitle>{job.title}</CardTitle>
                    <CardDescription>{job.company}</CardDescription>
                  </div>
                  <div className="rounded-md border bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                    {job.matchScore}% match
                  </div>
                </div>
                <JobMeta job={job} />
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{job.description}</p>
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
                />
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No local jobs found</CardTitle>
            <CardDescription>
              Run `npm run db:seed:jobs` to insert example MVP jobs into local Postgres.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

function JobMeta({ job }: { job: RecommendedJob }) {
  const items = [
    {
      label: job.location ?? "Location not listed",
      icon: MapPin,
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
