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
  runs?: RunView[];
  role?: string | null;
};

/**
 * CONTINUE, RECOMMENDED NEXT, AND EVERYTHING ELSE — laid out wide, nothing folded away.
 *
 * This page used to lay out the running projects, the report's route, every gap, a second
 * generated plan and the commitments one under another, and leave the person to work out which
 * one mattered. Fadi makes that call now (lib/learning/practice-home.ts) and puts its two
 * answers side by side at the top. The rest sits in open panels below: hidden content behind
 * dropdowns was harder to find than a wide page, so nothing here collapses.
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
  const inProgressCount = browse.runs.length + browse.commitments.length;

  return (
    <div className="mx-auto w-full max-w-[96rem] space-y-8 px-2 sm:px-4">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Learning</h1>
        <p className="text-sm text-muted-foreground">
          Build toward {direction}, one project at a time.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <SectionHeading icon={MonitorPlay} eyebrow="Continue" title="Where you left off" />
          {home.continue?.kind === "run" ? (
            <ProjectCard run={home.continue.run} featured />
          ) : home.continue?.kind === "commitment" ? (
            <CommitmentsList commitments={[home.continue.commitment]} heading={null} />
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-card/40 p-4 text-sm text-muted-foreground">
              Nothing in progress. Start with the recommendation beside this.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeading icon={Target} eyebrow="Recommended next" title="What to take on next" />
          {home.recommended.kind === "gap" ? (
            <article className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <h3 className="font-semibold">{home.recommended.gap.title}</h3>
              <p className="mt-2 text-xs font-medium text-muted-foreground">Why this</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                {home.recommended.gap.detail}{" "}
                {home.recommended.routeStep
                  ? `It is step ${home.recommended.routeStep} of the route in your latest career report, and nothing is under way for it yet.`
                  : "Your latest career report names it as a gap, and nothing is under way for it yet."}
              </p>
              <ResourceLinks skill={home.recommended.gap.title} />
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
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Also in progress" count={inProgressCount}>
          {inProgressCount === 0 ? (
            <Empty>Nothing else under way. One thing at a time is the point.</Empty>
          ) : (
            <div className="space-y-3">
              {browse.runs.map((run) => (
                <ProjectCard key={run.id} run={run} />
              ))}
              <CommitmentsList commitments={browse.commitments} heading={null} />
            </div>
          )}
        </Panel>

        <Panel title="Other gaps from your report" count={browse.gaps.length}>
          {browse.gaps.length === 0 ? (
            <Empty>
              {report
                ? "No other open gaps in your latest report."
                : "Generate a career report to see the gaps it names."}
            </Empty>
          ) : (
            <div className="space-y-2">
              {browse.gaps.map((gap) => (
                <article key={gap.title} className="rounded-xl border border-border/60 p-3">
                  <h4 className="text-sm font-medium">{gap.title}</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">{gap.detail}</p>
                  <GapGrowth gapTitle={gap.title} gapDetail={gap.detail} />
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Finished" count={browse.finished.length}>
          {browse.finished.length === 0 ? (
            <Empty>Finished projects and courses land here, and on your career record.</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {browse.finished.map((title) => (
                <li key={title} className="text-muted-foreground">
                  {title}
                </li>
              ))}
            </ul>
          )}
          <nav
            aria-label="More in Learning"
            className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs"
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
        </Panel>
      </div>

      {home.recommended.kind === "gap" ? (
        <section className="space-y-3">
          <SectionHeading icon={Map} eyebrow="Longer plan" title="Where this leads" />
          <CareerBlueprint role={role} />
        </section>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        {count > 0 ? <span className="ml-1.5 text-primary">{count}</span> : null}
      </h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
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
