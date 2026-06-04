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
import { matchAccent } from "@/lib/jobs/match-accent";
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

// Rich banner gradient — violet/indigo with a teal undertone, readable under white.
const DASH_BANNER =
  "radial-gradient(80% 130% at 100% 0%, oklch(0.5 0.2 288) 0%, transparent 55%)," +
  "radial-gradient(90% 130% at 0% 100%, oklch(0.48 0.16 232) 0%, transparent 55%)," +
  "linear-gradient(120deg, oklch(0.3 0.11 288), oklch(0.24 0.07 252))";

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
      {/* Banner */}
      <section
        className="relative overflow-hidden rounded-2xl border border-white/10 p-6 sm:p-8"
        style={{ backgroundImage: DASH_BANNER }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full opacity-30 blur-3xl"
          style={{ background: "oklch(0.66 0.22 300)" }}
        />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
            <Sparkles className="size-3" aria-hidden="true" />
            Career command center
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Your career, run by Kai
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
            Review your profile, generate your Career Intelligence Report, and act on what matters —
            Kai keeps the rest moving.
          </p>
          {userEmail ? (
            <p className="mt-2 text-xs text-white/50">Signed in as {userEmail}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="#career-report"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[oklch(0.64_0.25_300)] to-[oklch(0.6_0.2_262)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_30px_-8px_oklch(0.6_0.24_300_/_0.7)] transition-transform hover:-translate-y-0.5"
            >
              Generate report
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/dashboard/jobs"
              className="inline-flex items-center rounded-full border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Browse jobs
            </Link>
          </div>
        </div>
      </section>

      {/* Stat row */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="Career readiness"
          value={latestReport?.career_readiness_score != null ? String(latestReport.career_readiness_score) : "—"}
          sub="for your target role"
        />
        <StatCard
          icon={GraduationCap}
          label="Resume quality"
          value={latestReport?.resume_quality_score != null ? String(latestReport.resume_quality_score) : "—"}
          sub="clarity of evidence"
        />
        <StatCard
          icon={BriefcaseBusiness}
          label="Top job match"
          value={
            recommendedJobsPreview.length > 0
              ? `${Math.max(...recommendedJobsPreview.map((j) => j.matchScore ?? 0))}%`
              : "—"
          }
          sub="best current fit"
        />
        <StatCard
          icon={Sparkles}
          label="Momentum"
          value={String(Math.round(momentum.momentum))}
          sub={momentum.band}
        />
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

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-3xl font-semibold tabular-nums">{value}</div>
          <p className="mt-1 text-sm font-medium">{label}</p>
          <p className="text-xs capitalize text-muted-foreground">{sub}</p>
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-[oklch(0.66_0.22_285)]/15 text-primary ring-1 ring-primary/15">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </div>
    </Card>
  );
}

function formatExperienceLevel(value: string | null) {
  if (!value) {
    return null;
  }

  return value.replaceAll("_", " ");
}
