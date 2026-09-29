import Link from "next/link";
import { BookOpen, GraduationCap, Map, MonitorPlay, Target } from "lucide-react";

import type { RunView } from "@/app/dashboard/learning/lab-actions";
import { CommitmentsList, GapGrowth } from "@/components/learning/gap-growth";
import { CareerBlueprint } from "@/components/learning/career-blueprint";
import { ProjectCard } from "@/components/learning/project-run";
import type { CommitmentView } from "@/lib/learning/commitments-view";
import type { StoredCareerReport } from "@/lib/career-report/schema";
import { buildPracticeHome } from "@/lib/learning/practice-home";
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
  runs?: RunView[];
  role?: string | null;
};

/**
 * CONTINUE, RECOMMENDED NEXT, BROWSE — in that order, one decision each.
 *
 * This page used to lay out the running projects, the report's route, every gap, a second
 * generated plan and the commitments side by side, and leave the person to work out which
 * one mattered. Fadi makes that call now (lib/learning/practice-home.ts); the rest is
 * still here, under Browse, for anyone who wants to choose for themselves.
 */
export function LearningShell({ report, commitments = [], runs = [], role = null }: Props) {
  const home = buildPracticeHome({
    runs,
    commitments,
    gaps: report?.missing_skills ?? [],
    route: report?.recommended_learning_path ?? [],
  });
  const direction = role ?? "your next role";
  const { browse } = home;
  const browseCount =
    browse.runs.length + browse.commitments.length + browse.gaps.length + browse.finished.length;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-2 sm:px-4">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Learning</h1>
        <p className="text-sm text-muted-foreground">
          Build toward {direction}, one project at a time.
        </p>
      </header>

      <section className="space-y-3">
        <SectionHeading icon={MonitorPlay} eyebrow="Continue" title="Where you left off" />
        {home.continue?.kind === "run" ? (
          <ProjectCard run={home.continue.run} featured />
        ) : home.continue?.kind === "commitment" ? (
          <CommitmentsList commitments={[home.continue.commitment]} />
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-card/40 p-4 text-sm text-muted-foreground">
            Nothing in progress. Start with the recommendation below.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeading icon={Target} eyebrow="Recommended next" title="What to take on next" />
        {home.recommended.kind === "gap" ? (
          <article className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h3 className="font-semibold">{home.recommended.gap.title}</h3>
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-muted-foreground">Why this?</summary>
              <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <p>{home.recommended.gap.detail}</p>
                <p>
                  {home.recommended.routeStep
                    ? `It is step ${home.recommended.routeStep} of the route in your latest career report, and nothing is under way for it yet.`
                    : "Your latest career report names it as a gap, and nothing is under way for it yet."}
                </p>
                <ResourceLinks skill={home.recommended.gap.title} />
              </div>
            </details>
            <GapGrowth
              gapTitle={home.recommended.gap.title}
              gapDetail={home.recommended.gap.detail}
            />
          </article>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {home.recommended.reason === "no-report"
                ? `Fadi can map the certifications and projects that lead to ${direction} from your direction and history.`
                : "Every gap in your latest report already has work against it. Map what comes after them."}
            </p>
            <CareerBlueprint role={role} />
          </div>
        )}
      </section>

      <details className="group rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Browse{browseCount > 0 ? ` (${browseCount})` : ""}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            everything else, when you want to choose yourself
          </span>
        </summary>
        <div className="mt-4 space-y-6">
          {browse.runs.length > 0 ? (
            <BrowseGroup title="Other projects in progress">
              <div className="space-y-3">
                {browse.runs.map((run) => (
                  <ProjectCard key={run.id} run={run} />
                ))}
              </div>
            </BrowseGroup>
          ) : null}

          {browse.commitments.length > 0 ? (
            <CommitmentsList commitments={browse.commitments} />
          ) : null}

          {browse.gaps.length > 0 ? (
            <BrowseGroup title="Other gaps from your report">
              <div className="space-y-2">
                {browse.gaps.map((gap) => (
                  <article key={gap.title} className="rounded-xl border border-border/60 p-3">
                    <h4 className="text-sm font-medium">{gap.title}</h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">{gap.detail}</p>
                    <GapGrowth gapTitle={gap.title} gapDetail={gap.detail} />
                  </article>
                ))}
              </div>
            </BrowseGroup>
          ) : null}

          {home.recommended.kind === "gap" ? (
            <BrowseGroup title="A longer plan">
              <CareerBlueprint role={role} />
            </BrowseGroup>
          ) : null}

          {browse.finished.length > 0 ? (
            <BrowseGroup title="Finished">
              <p className="text-sm text-muted-foreground">{browse.finished.join(" · ")}</p>
            </BrowseGroup>
          ) : null}

          <nav
            aria-label="More in Learning"
            className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs"
          >
            <Link
              href="/dashboard/learning/projects"
              className="text-muted-foreground hover:text-foreground"
            >
              All projects
            </Link>
            <Link
              href="/dashboard/learning/machines"
              className="text-muted-foreground hover:text-foreground"
            >
              Machines
            </Link>
            <Link
              href="/dashboard/learning/activity"
              className="text-muted-foreground hover:text-foreground"
            >
              Activity
            </Link>
          </nav>
        </div>
      </details>
    </div>
  );
}

function BrowseGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
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
  detail?: string;
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
