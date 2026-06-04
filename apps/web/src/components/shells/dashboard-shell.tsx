import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  GraduationCap,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { GenerateReportButton } from "@/components/dashboard/generate-report-button";
import { MomentumPanel, type MomentumView } from "@/components/resilience/momentum-panel";
import { cn } from "@/lib/utils";
import { matchAccent } from "@/lib/jobs/match-accent";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardProfileSummary, StoredCareerReport } from "@/lib/career-report/schema";
import type { RecommendedJob } from "@/lib/jobs/types";
import type { MomentumSummary } from "@/lib/resilience/service";

function toMomentumView(m: MomentumSummary): MomentumView {
  return {
    score: m.momentum,
    band: m.band,
    bandMessage: m.bandMessage,
    isResting: m.isResting,
    cadenceTarget: m.cadenceTarget,
    cadencePeriod: m.cadencePeriod,
    cadenceMessage: m.cadenceMessage,
    qualityApplicationsThisPeriod: m.qualityApplicationsThisPeriod,
  };
}

type DashboardShellProps = {
  userEmail?: string;
  profileSummary: DashboardProfileSummary | null;
  latestReport: StoredCareerReport | null;
  recommendedJobsPreview: RecommendedJob[];
  momentum: MomentumSummary;
};

export function DashboardShell({
  userEmail,
  profileSummary,
  latestReport,
  recommendedJobsPreview,
  momentum,
}: DashboardShellProps) {
  return (
    <div className="mx-auto max-w-shell space-y-6">
      <section className="relative overflow-hidden rounded-xl border bg-card p-6">
        {/* Aurora glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full opacity-[0.13] blur-3xl"
          style={{ background: "oklch(0.66 0.22 285)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-12 top-0 size-60 rounded-full opacity-[0.1] blur-3xl"
          style={{ background: "oklch(0.72 0.19 192)" }}
        />
        <div className="relative">
          <Badge variant="secondary">Career dashboard</Badge>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-3xl font-semibold tracking-tight">
                Your career{" "}
                <span className="bg-gradient-to-r from-primary via-[oklch(0.7_0.17_230)] to-[oklch(0.68_0.22_285)] bg-clip-text text-transparent">
                  command center
                </span>
              </h2>
              <p className="text-muted-foreground">
                Review your onboarding profile and generate your first AI Career Intelligence Report.
              </p>
              {userEmail ? (
                <p className="text-sm text-muted-foreground">Signed in as {userEmail}</p>
              ) : null}
            </div>
            <Link href="#career-report" className={cn(buttonVariants(), "glow-primary")}>
              Generate report
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <MomentumPanel momentum={toMomentumView(momentum)} />

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card id="career-report">
          <CardHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
              <Target className="size-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Onboarding profile summary</CardTitle>
              <CardDescription>
                The data CareerOS AI will use for your first report.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {profileSummary ? (
              <div className="space-y-4">
                <SummaryGrid profileSummary={profileSummary} />
                <PreviewBlock
                  title="LinkedIn context"
                  value={profileSummary.linkedInProfilePreview}
                />
                <PreviewBlock title="Resume text" value={profileSummary.resumePreview} />
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Complete onboarding before generating a report.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Career Intelligence Report</CardTitle>
              <CardDescription>
                Generate structured insights from your onboarding profile, LinkedIn context, resume,
                and goals.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              AI recommendations may be imperfect. Review every suggestion before making career,
              learning, or application decisions.
            </div>
            <GenerateReportButton />
            {latestReport ? (
              <CareerReportView report={latestReport} />
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No report generated yet. Use the action above to create your first Career
                Intelligence Report.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <ScoreCard
          title="Career readiness"
          score={latestReport?.career_readiness_score}
          description="How ready your profile appears for your target role."
          icon={TrendingUp}
        />
        <ScoreCard
          title="Resume quality"
          score={latestReport?.resume_quality_score}
          description="How clearly your resume communicates role-relevant evidence."
          icon={GraduationCap}
        />
      </section>

      <Card id="recommended-jobs">
        <CardHeader className="flex flex-row items-start gap-4 space-y-0">
          <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
            <BriefcaseBusiness className="size-5" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <CardTitle>Recommended jobs</CardTitle>
            <CardDescription>
              Local MVP job matches based on your onboarding profile and resume text.
            </CardDescription>
          </div>
          <Link href="/dashboard/jobs" className={buttonVariants({ variant: "outline" })}>
            View jobs
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </CardHeader>
        <CardContent>
          {recommendedJobsPreview.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              {recommendedJobsPreview.map((job) => (
                <div key={job.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium">{job.title}</h3>
                      <p className="text-sm text-muted-foreground">{job.company}</p>
                    </div>
                    <span
                      style={matchAccent(job.matchScore).style}
                      className="shrink-0 rounded-full border border-dynamic bg-dynamic-soft px-2 py-0.5 text-xs font-medium tabular-nums text-dynamic"
                    >
                      {job.matchScore}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {[job.location, job.remoteMode, job.seniority].filter(Boolean).join(" / ")}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No seeded local jobs found yet. Run `npm run db:seed:jobs` to add example MVP jobs.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryGrid({ profileSummary }: { profileSummary: DashboardProfileSummary }) {
  const rows = [
    ["Name", profileSummary.fullName],
    ["Target role", profileSummary.targetRole],
    ["Location", profileSummary.locationPreference],
    ["Experience", formatExperienceLevel(profileSummary.experienceLevel)],
    ["Goals", profileSummary.careerGoals],
  ];

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-md border p-3">
          <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-sm">{value || "Not provided"}</dd>
        </div>
      ))}
    </dl>
  );
}

function PreviewBlock({ title, value }: { title: string; value: string | null }) {
  return (
    <div className="rounded-md border p-3">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{value || "Not provided"}</p>
    </div>
  );
}

function CareerReportView({ report }: { report: StoredCareerReport }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4">
        <h3 className="font-medium">Career summary</h3>
        <p className="mt-2 text-sm text-muted-foreground">{report.career_summary}</p>
      </div>
      <ReportList title="Strengths" items={report.strengths} />
      <ReportList title="Missing skills" items={report.missing_skills} />
      <div className="rounded-md border p-4">
        <h3 className="font-medium">Target role fit</h3>
        <p className="mt-1 text-sm capitalize text-muted-foreground">
          Rating: {report.target_role_fit?.rating ?? "unclear"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{report.target_role_fit?.explanation}</p>
      </div>
      <ReportList title="Recommended next steps" items={report.recommended_actions} />
      <ReportList title="Learning recommendations" items={report.recommended_learning_path} />
      <p className="text-xs text-muted-foreground">
        Generated{" "}
        {report.generated_at ? new Date(report.generated_at).toLocaleString() : "recently"}
        {report.model_name ? ` using ${report.model_name}` : ""}.
      </p>
    </div>
  );
}

function ReportList({
  title,
  items,
}: {
  title: string;
  items: Array<{ title: string; detail: string }>;
}) {
  return (
    <div className="rounded-md border p-4">
      <h3 className="font-medium">{title}</h3>
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={`${title}-${item.title}`} className="text-sm">
            <p className="font-medium">{item.title}</p>
            <p className="text-muted-foreground">{item.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScoreCard({
  title,
  score,
  description,
  icon: Icon,
}: {
  title: string;
  score?: number | null;
  description: string;
  icon: typeof TrendingUp;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {typeof score === "number" ? (
          <div className="text-3xl font-semibold">{score}/100</div>
        ) : (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Generate a report to see this score.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatExperienceLevel(value: string | null) {
  if (!value) {
    return null;
  }

  return value.replaceAll("_", " ");
}
