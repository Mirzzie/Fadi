import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Layers3,
  Map,
  MonitorPlay,
  Route,
  Target,
} from "lucide-react";

import { FadiBadge } from "@/components/ui/fadi-badge";
import { buttonVariants } from "@/components/ui/button";
import { CommitmentsList, GapGrowth } from "@/components/learning/gap-growth";
import { CareerBlueprint } from "@/components/learning/career-blueprint";
import { LearningNavigation } from "@/components/learning/learning-navigation";
import type { CommitmentView } from "@/lib/learning/commitments-view";
import { ProjectRuns } from "@/components/learning/project-run";
import type { StoredCareerReport } from "@/lib/career-report/schema";
import { learningResources } from "@/lib/learning/resources";

/** Free reference links for a skill. ("Build a project" lives in the AI suggest
 *  button below — one concept, one control, no duplicate.) */
function ResourceLinks({ skill }: { skill: string }) {
  const r = learningResources(skill);
  // roadmap.sh is software-only, so it is offered ONLY when the skill actually
  // matches one. Every other field gets the neutral links without a dead end.
  const items = [
    ...(r.roadmap ? [{ href: r.roadmap, label: "Roadmap", icon: Map }] : []),
    { href: r.youtube, label: "Tutorials", icon: MonitorPlay },
    { href: r.courses, label: "Free courses", icon: GraduationCap },
    { href: r.practice, label: "Practise it", icon: GraduationCap },
  ];
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {items.map((it) => (
        <a
          key={it.label}
          href={it.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <it.icon className="size-3.5" aria-hidden="true" />
          {it.label}
        </a>
      ))}
    </div>
  );
}

type Props = {
  report: StoredCareerReport | null;
  commitments?: CommitmentView[];
  role?: string | null;
};

export function LearningShell({ report, commitments = [], role = null }: Props) {
  const skillGaps = report?.missing_skills ?? [];
  const learningPath = report?.recommended_learning_path ?? [];
  const hasContent = skillGaps.length > 0 || learningPath.length > 0;
  const activeCommitments = commitments.filter((commitment) => commitment.status === "committed");
  const direction = role ?? "your next role";

  return (
    <div className="mx-auto w-full max-w-[96rem] space-y-6 px-2 sm:px-4">
      <LearningNavigation />

      <section className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-28 size-96 rounded-full opacity-[0.16] blur-3xl [background:var(--aurora-1)]"
        />
        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Route className="size-3.5" aria-hidden="true" /> Learning path
              <ArrowRight className="size-3" aria-hidden="true" /> {direction}
            </p>
            <div className="mt-4 flex items-start gap-4">
              <div className="glow-primary grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-[oklch(0.66_0.22_285)]">
                <GraduationCap className="size-6 text-primary-foreground" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                  Build toward {direction}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Follow a route grounded in your career report, practise on machines you control,
                  and keep the result of each build as evidence.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 lg:min-w-80">
            <PlanStat value={skillGaps.length} label="skills to prove" />
            <PlanStat value={learningPath.length} label="route stages" />
            <PlanStat value={activeCommitments.length} label="commitments" />
          </div>
        </div>

        <div className="relative grid border-t border-border/60 bg-background/35 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="px-6 py-3 text-xs text-muted-foreground sm:px-8">
            {report?.target_role_fit?.explanation
              ? report.target_role_fit.explanation
              : "Generate a Career Intelligence Report to ground this route in your current evidence."}
          </div>
          {report?.career_readiness_score != null ? (
            <div className="flex items-center justify-between gap-3 border-t border-border/60 px-6 py-3 sm:border-l sm:border-t-0 sm:px-5">
              <span className="text-xs text-muted-foreground">Career report score</span>
              <span className="font-mono text-sm font-semibold tabular-nums">
                {report.career_readiness_score}/100
              </span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading
          icon={MonitorPlay}
          eyebrow="Continue"
          title="Return to the work"
          detail="Your next project step stays ahead of planning, links, and administration."
        />
        <ProjectRuns mode="overview" />
      </section>

      {!hasContent ? (
        <div className="gradient-border glass-card rounded-xl p-6">
          <div className="flex items-start gap-4">
            <FadiBadge size="sm" showName={false} />
            <div className="space-y-3">
              <p className="text-sm font-medium text-primary">Fadi</p>
              <p className="text-sm leading-relaxed text-card-foreground">
                Generate your Career Intelligence Report from the dashboard and I&apos;ll turn your
                skill gaps into a prioritized learning plan tied to your target role.
              </p>
              <Link href="/dashboard#career-report" className={buttonVariants({ size: "sm" })}>
                Generate report
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="space-y-3">
            <SectionHeading
              icon={Layers3}
              eyebrow="Route"
              title="Learn in this order"
              detail="A recommendation from your latest report, not a claim that every stage is complete."
            />
            <ol className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {learningPath.map((step, index) => (
                <li
                  key={step.title}
                  className="relative grid grid-cols-[2.5rem_1fr] gap-3 border-b border-border/60 p-4 last:border-b-0"
                >
                  <div className="relative flex justify-center">
                    <span className="grid size-7 place-items-center rounded-full border border-primary/40 bg-primary/10 text-xs font-semibold text-primary tabular-nums">
                      {index + 1}
                    </span>
                    {index < learningPath.length - 1 ? (
                      <span
                        className="absolute bottom-[-1rem] top-8 w-px bg-border"
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{step.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {step.detail}
                    </p>
                    <ResourceLinks skill={step.title} />
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="space-y-3">
            <SectionHeading
              icon={Target}
              eyebrow="Prove"
              title="Skills that need evidence"
              detail="Turn a gap into a build when you are ready. A completed tutorial alone does not become evidence."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {skillGaps.map((gap, index) => (
                <article
                  key={gap.title}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{gap.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {gap.detail}
                      </p>
                    </div>
                  </div>
                  <ResourceLinks skill={gap.title} />
                  <GapGrowth gapTitle={gap.title} gapDetail={gap.detail} />
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      <CareerBlueprint role={role} />

      <CommitmentsList commitments={commitments} />
    </div>
  );
}

function PlanStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/45 px-3 py-3 text-center backdrop-blur-sm">
      <p className="font-mono text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  eyebrow,
  title,
  detail,
}: {
  icon: typeof BookOpen;
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
          {eyebrow}
        </p>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
