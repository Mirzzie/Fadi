import Link from "next/link";
import { BookOpen, GraduationCap, Hammer, Map, MonitorPlay, Target } from "lucide-react";

import { FadiBadge } from "@/components/ui/fadi-badge";
import { buttonVariants } from "@/components/ui/button";
import type { StoredCareerReport } from "@/lib/career-report/schema";
import { learningResources } from "@/lib/learning/resources";
import { cn } from "@/lib/utils";

/** Free, actionable resources for a skill — roadmap.sh, YouTube, courses, project. */
function ResourceLinks({ skill }: { skill: string }) {
  const r = learningResources(skill);
  const items = [
    { href: r.roadmap, label: "Roadmap", icon: Map },
    { href: r.youtube, label: "Tutorials", icon: MonitorPlay },
    { href: r.courses, label: "Free courses", icon: GraduationCap },
    { href: r.project, label: "Build a project", icon: Hammer },
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

type Props = { report: StoredCareerReport | null };

export function LearningShell({ report }: Props) {
  const skillGaps = report?.missing_skills ?? [];
  const learningPath = report?.recommended_learning_path ?? [];
  const hasContent = skillGaps.length > 0 || learningPath.length > 0;

  return (
    <div className="mx-auto max-w-shell space-y-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full opacity-[0.12] blur-3xl"
          style={{ background: "oklch(0.7 0.17 230)" }}
        />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="glow-primary grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.66_0.22_285)]">
              <GraduationCap className="size-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Learning{" "}
                <span className="bg-gradient-to-r from-primary to-[oklch(0.7_0.17_230)] bg-clip-text text-transparent">
                  Hub
                </span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your skill gaps and a prioritized learning path, drawn from your Career Intelligence
                Report.
              </p>
            </div>
          </div>
          {report?.career_readiness_score != null ? (
            <div className="hidden shrink-0 text-right sm:block">
              <div className="text-2xl font-semibold tabular-nums">
                {report.career_readiness_score}
                <span className="text-sm text-muted-foreground">/100</span>
              </div>
              <p className="text-xs text-muted-foreground">readiness</p>
            </div>
          ) : null}
        </div>
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
        <>
          {/* Skill gaps */}
          {skillGaps.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-primary" aria-hidden="true" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Skill gaps to close
                </h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {skillGaps.map((gap, i) => (
                  <div key={gap.title} className="rounded-xl border border-border/60 bg-card p-5">
                    <div className="flex items-start gap-3">
                      <div
                        className="grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums"
                        style={{
                          background: "oklch(0.66 0.22 285 / 0.15)",
                          color: "oklch(0.72 0.19 285)",
                        }}
                      >
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-medium">{gap.title}</h4>
                        <p className="mt-1 text-sm text-muted-foreground">{gap.detail}</p>
                        <ResourceLinks skill={gap.title} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Learning path */}
          {learningPath.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-primary" aria-hidden="true" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Your learning path
                </h3>
              </div>
              <ol className="space-y-3">
                {learningPath.map((step, i) => (
                  <li
                    key={step.title}
                    className={cn(
                      "relative rounded-xl border border-border/60 bg-card p-5 pl-14",
                    )}
                  >
                    <span className="glow-primary absolute left-5 top-5 grid size-7 place-items-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.66_0.22_285)] text-xs font-semibold text-primary-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <h4 className="font-medium">{step.title}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
                    <ResourceLinks skill={step.title} />
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BookOpen className="size-3 text-primary/60" aria-hidden="true" />
            Each item links to a roadmap, video tutorials, free courses and a project to build —
            work top-down: the highest-impact gap first. Ask Fadi in chat to plan any of these out.
          </p>
        </>
      )}
    </div>
  );
}
