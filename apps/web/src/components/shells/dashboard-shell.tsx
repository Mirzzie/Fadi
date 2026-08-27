import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  GraduationCap,
  Hammer,
  MessageSquareQuote,
  Pencil,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { GenerateReportButton } from "@/components/dashboard/generate-report-button";
import { FadiBriefing } from "@/components/os/fadi-briefing";
import { GuidedSetup } from "@/components/os/guided-setup";
import { MomentumPanel, type MomentumView } from "@/components/resilience/momentum-panel";
import { MomentumReflectionCard } from "@/components/resilience/momentum-reflection";
import type { MomentumReflection } from "@/lib/resilience/reflection";
import type { Briefing } from "@/lib/agents/briefing";
import type { SetupState } from "@/lib/guidance/setup";
import { matchAccent } from "@/lib/jobs/match-accent";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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

type MarketSignal = {
  kind: "news" | "skill_trend" | "labor";
  title: string;
  url: string | null;
  relevance: number;
  reason: string;
};

export type DashboardOpportunity = { label: string; detail: string; href: string };

type DashboardShellProps = {
  userEmail?: string;
  /** Fadi's proactive spoken briefing, shown at the top of Mission Control. */
  briefing?: Briefing;
  /** Personalized greeting + Fadi-surfaced opportunities for the Mission Control hero. */
  greeting?: string;
  subline?: string;
  opportunities?: DashboardOpportunity[];
  profileSummary: DashboardProfileSummary | null;
  latestReport: StoredCareerReport | null;
  /** Whether the report has drifted out of sync with the user's evidence/résumé. */
  reportStale?: { stale: boolean; reason: string | null } | null;
  recommendedJobsPreview: RecommendedJob[];
  momentum: MomentumSummary;
  /** You-vs-past-self + morale read (honest "how am I really doing"). */
  reflection?: MomentumReflection | null;
  marketSignals: MarketSignal[];
  setup?: SetupState | null;
  /** Open (not-yet-completed) builds in the active direction's Prepare plan. */
  openBuilds?: number;
};

export function DashboardShell({
  userEmail,
  briefing,
  greeting,
  subline,
  opportunities = [],
  profileSummary,
  latestReport,
  reportStale,
  recommendedJobsPreview,
  momentum,
  reflection,
  marketSignals,
  setup,
  openBuilds = 0,
}: DashboardShellProps) {
  return (
    <div className="mx-auto max-w-shell space-y-8">
      {/* Fadi greets you first — his proactive, spoken briefing. */}
      {briefing ? <FadiBriefing briefing={briefing} /> : null}

      {/* Mission Control hero — greeting + the live opportunities Fadi has lined up.
          Theme-aware, on Fadi's own teal/aurora (was a heavy dark violet banner). */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {/* Soft aurora identity — quiet, so it never fights the content. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full opacity-[0.12] blur-3xl [background:var(--aurora-2)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-10 size-64 rounded-full opacity-[0.10] blur-3xl [background:var(--aurora-1)]"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3 text-primary" aria-hidden="true" />
            Mission Control
          </span>
          <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {greeting ?? "Your career, run by Fadi"}
          </h2>
          <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">
            {subline ??
              "Review your profile, generate your Career Intelligence Report, and act on what matters — Fadi keeps the rest moving."}
          </p>

          {/* Live opportunities Fadi surfaced — the proactive heart of the OS. */}
          {opportunities.length > 0 ? (
            <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
              {opportunities.map((opp, i) => (
                <Link
                  key={`${opp.label}-${opp.detail}-${i}`}
                  href={opp.href}
                  className="group rounded-xl border border-border bg-muted/40 p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                      {opp.label}
                    </p>
                    <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-foreground">{opp.detail}</p>
                </Link>
              ))}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="#career-report"
              className={cn(buttonVariants({ size: "lg" }), "h-10 rounded-full px-5 text-sm font-semibold")}
            >
              Generate report
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/dashboard/jobs"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-10 rounded-full px-5 text-sm font-semibold",
              )}
            >
              Browse jobs
            </Link>
            {userEmail ? (
              <span className="text-xs text-muted-foreground">Signed in as {userEmail}</span>
            ) : null}
          </div>
        </div>
      </section>

      {/* The loop's pull-back: builds waiting in the active direction's Prepare plan
          (often prescribed by a rejection autopsy). A reason to come back and finish one. */}
      {openBuilds > 0 ? (
        <Link
          href="/dashboard/learning"
          className="group flex items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Hammer className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">
                {openBuilds} build{openBuilds === 1 ? "" : "s"} waiting in your Prepare plan
              </p>
              <p className="text-xs text-muted-foreground">
                Finish one to turn it into real proof for your next application.
              </p>
            </div>
          </div>
          <ArrowRight
            className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      ) : null}

      {/* Quick actions — the unimad-style hub row: add an application, see the tracker,
          prepare for interviews. One clear thing to do in each. */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* Add an application */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-heading text-base font-semibold">Add an application</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a job URL to save it straight to your tracker.
          </p>
          <div className="mt-auto pt-4">
            <Link
              href="/dashboard/applications"
              className={cn(buttonVariants(), "w-full rounded-full")}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add to tracker
            </Link>
          </div>
        </div>

        {/* Tracker stats */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Quality applications · this {momentum.cadencePeriod}
          </p>
          <div className="mt-1 font-heading text-3xl font-semibold tabular-nums">
            {momentum.qualityApplicationsThisPeriod ?? 0}
            <span className="text-base font-medium text-muted-foreground">
              /{momentum.cadenceTarget ?? 0}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-[oklch(0.66_0.22_285)]"
              style={{
                width: `${Math.min(100, Math.round(((momentum.qualityApplicationsThisPeriod ?? 0) / Math.max(momentum.cadenceTarget ?? 0, 1)) * 100))}%`,
              }}
            />
          </div>
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{momentum.cadenceMessage}</p>
          <div className="mt-auto pt-4">
            <Link
              href="/dashboard/applications"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              View tracker →
            </Link>
          </div>
        </div>

        {/* Prepare for interviews — accent card */}
        <div className="flex flex-col rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/12 to-[oklch(0.55_0.2_285)]/10 p-5 shadow-sm">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/25 bg-card/60 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
            Next up
          </span>
          <h3 className="mt-2 font-heading text-base font-semibold">Prepare for interviews</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Simulate real questions, refine your answers, and get structured feedback.
          </p>
          <div className="mt-auto pt-4">
            <Link
              href="/dashboard/interview"
              className={cn(buttonVariants(), "w-full rounded-full")}
            >
              <MessageSquareQuote className="size-4" aria-hidden="true" />
              Start practice interview
            </Link>
          </div>
        </div>
      </section>

      {/* Guided setup — the OS leads the user through personalize → analyze → act.
          Hidden once everything's done so power users get a clean dashboard. */}
      {setup && !setup.allDone ? <GuidedSetup setup={setup} /> : null}

      {/* Zone: At a glance */}
      <section className="space-y-3">
        <ZoneHeading>At a glance</ZoneHeading>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        </div>
      </section>

      {/* Zone: Your momentum — the anti-give-up core, all in one place */}
      <section className="space-y-3">
        <ZoneHeading>Your momentum</ZoneHeading>
        <MomentumPanel momentum={toMomentumView(momentum)} />
        {reflection ? <MomentumReflectionCard reflection={reflection} /> : null}
      </section>

      {/* Zone: Your profile & report */}
      <section className="space-y-3">
        <ZoneHeading>Your profile &amp; report</ZoneHeading>
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card id="career-report">
          <CardHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
              <Target className="size-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Onboarding profile summary</CardTitle>
              <CardDescription>
                The data Fadi will use for your first report.
              </CardDescription>
            </div>
            <Link
              href="/dashboard/profile"
              className={`${buttonVariants({ variant: "outline", size: "sm" })} ml-auto shrink-0`}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit
            </Link>
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
            {latestReport && reportStale?.stale ? (
              // Living projection: the report knows when it's out of date with the
              // evidence it was built from, and says so — rather than silently drifting.
              // It does NOT auto-regenerate (that would spend the user's AI budget
              // without asking); the "Generate report" action above is the one click.
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  This report is out of date.
                </span>{" "}
                <span className="text-muted-foreground">
                  {reportStale.reason} Regenerate it to reflect your latest history.
                </span>
              </div>
            ) : null}
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
        </div>
      </section>

      {/* Zone: What's out there */}
      <section className="space-y-3">
        <ZoneHeading>What&apos;s out there</ZoneHeading>
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
                // unimad-style role card: logo tile, meta, and a Prepare / Apply-now
                // button pair — both open the workspace the Jobs page uses (fit-check
                // → draft → apply).
                <div
                  key={job.id}
                  className="flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.5_0.2_285)] font-heading text-sm font-bold text-primary-foreground">
                      {job.company?.slice(0, 1)?.toUpperCase() ?? "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold">{job.title}</h3>
                      <p className="truncate text-xs text-muted-foreground">{job.company}</p>
                    </div>
                    <span
                      style={matchAccent(job.matchScore).style}
                      className="shrink-0 rounded-full border border-dynamic bg-dynamic-soft px-2 py-0.5 text-xs font-medium tabular-nums text-dynamic"
                    >
                      {job.matchScore}%
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                    {[job.location, job.remoteMode, job.seniority].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/dashboard/applications/${job.id}/workspace`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1 rounded-full")}
                    >
                      Prepare
                    </Link>
                    <Link
                      href={`/dashboard/applications/${job.id}/workspace`}
                      className={cn(buttonVariants({ size: "sm" }), "flex-1 rounded-full")}
                    >
                      Apply now
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No matches yet — set your target role and location, and I&apos;ll pull live roles into your Jobs board.
            </div>
          )}
        </CardContent>
      </Card>

        <MarketSignalsCard signals={marketSignals} />
      </section>
    </div>
  );
}

/** A small, quiet zone label so the dashboard reads as grouped sections, not a wall. */
function ZoneHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

const SIGNAL_KIND_LABEL: Record<MarketSignal["kind"], string> = {
  news: "Market news",
  skill_trend: "Skill trend",
  labor: "Labor signal",
};

function MarketSignalsCard({ signals }: { signals: MarketSignal[] }) {
  return (
    <Card id="market-signals">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
          <TrendingUp className="size-5" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <CardTitle>Live market signals</CardTitle>
          <CardDescription>
            Signals from live sources (GDELT, Hacker News, Remotive), refreshed regularly and scored
            against your target role and skill gaps — a reality check on your report.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {signals.length > 0 ? (
          <ul className="space-y-2.5">
            {signals.map((s, i) => {
              const accent = matchAccent(s.relevance);
              return (
                <li
                  key={`${s.title}-${i}`}
                  className="flex items-start justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        style={accent.style}
                        className="shrink-0 rounded-full border border-dynamic bg-dynamic-soft px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-dynamic"
                      >
                        {SIGNAL_KIND_LABEL[s.kind]}
                      </span>
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-sm font-medium hover:text-primary hover:underline"
                        >
                          {s.title}
                        </a>
                      ) : (
                        <span className="truncate text-sm font-medium">{s.title}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.reason}</p>
                  </div>
                  <span
                    style={accent.style}
                    className="shrink-0 text-sm font-semibold tabular-nums text-dynamic"
                  >
                    {s.relevance}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No live signals clear the relevance threshold for your profile right now. Fadi keeps
            watching — set a target role in your profile to sharpen this.
          </div>
        )}
      </CardContent>
    </Card>
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
          <div className="font-heading text-3xl font-semibold tabular-nums">{value}</div>
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
