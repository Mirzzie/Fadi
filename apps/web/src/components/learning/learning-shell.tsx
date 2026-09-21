import Link from "next/link";
import { BookOpen, GraduationCap, Layers3, Map, MonitorPlay, Target } from "lucide-react";

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
    <details className="mt-3">
      <summary className="cursor-pointer text-xs text-muted-foreground">Learning resources</summary>
      <div className="mt-2 flex flex-wrap gap-1.5">
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
    </details>
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
  const direction = role ?? "your next role";

  return (
    <div className="mx-auto w-full max-w-[96rem] space-y-6 px-2 sm:px-4">
      <LearningNavigation />

      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Learning</h1>
        <p className="text-sm text-muted-foreground">
          Build toward {direction}, one project at a time.
        </p>
      </header>

      <section className="space-y-3">
        <SectionHeading
          icon={MonitorPlay}
          eyebrow="Continue"
          title="Continue your project"
          detail=""
        />
        <ProjectRuns mode="overview" />
      </section>

      <details className="rounded-xl border border-border bg-card p-4" open>
        <summary className="cursor-pointer text-sm font-semibold">Find your next project</summary>
        <div className="mt-4">
          {!hasContent ? (
            <div className="gradient-border glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <FadiBadge size="sm" showName={false} />
                <div className="space-y-3">
                  <p className="text-sm font-medium text-primary">Fadi</p>
                  <p className="text-sm leading-relaxed text-card-foreground">
                    Generate your Career Intelligence Report from the dashboard and I&apos;ll turn
                    your skill gaps into a prioritized learning plan tied to your target role.
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
        </div>
      </details>

      <details className="rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Explore a longer learning plan
        </summary>
        <div className="mt-4">
          <CareerBlueprint role={role} />
        </div>
      </details>

      <CommitmentsList commitments={commitments} />
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
        {detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}
