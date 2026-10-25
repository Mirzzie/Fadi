import Link from "next/link";
import { ArrowUpRight, BookOpen, GraduationCap, Map, MonitorPlay, Target } from "lucide-react";

import type { RunView } from "@/app/dashboard/learning/lab-actions";
import { CommitmentsList, GapGrowth } from "@/components/learning/gap-growth";
import { CareerBlueprint } from "@/components/learning/career-blueprint";
import { FlagshipProjects } from "@/components/learning/flagships";
import { ProjectCard } from "@/components/learning/project-run";
import type { CommitmentView } from "@/lib/learning/commitments-view";
import type { StoredCareerReport } from "@/lib/career-report/schema";
import type { FlagshipsState } from "@/lib/learning/flagships";
import { buildPracticeHome } from "@/lib/learning/practice-home";
import { learningResources } from "@/lib/learning/resources";
import { installedActivities } from "@/lib/practice/packs";
import { practiceSimulation } from "@/lib/learning/practice-simulation";
import styles from "./learning-shell.module.css";

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
          className="inline-flex items-center gap-1.5 border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
  domain?: string | null;
  flagships?: FlagshipsState | null;
};

/**
 * One continuation, then deliberately quieter discovery. buildPracticeHome remains the
 * authority for what is current; composition adds no local progress or completion state.
 */
export function LearningShell({
  report,
  commitments = [],
  runs = [],
  role = null,
  domain = null,
  flagships = null,
}: Props) {
  const home = buildPracticeHome({
    runs,
    commitments,
    gaps: report?.missing_skills ?? [],
    route: report?.recommended_learning_path ?? [],
  });
  const direction = role ?? "your next role";
  const simulation = practiceSimulation({ role, domain }, installedActivities());
  const { browse } = home;
  const inProgressCount = browse.runs.length + browse.commitments.length;
  // The single gap recommendation is a smaller step now; flagships are the headline.
  const gapList = [
    ...(home.recommended.kind === "gap" ? [home.recommended.gap] : []),
    ...browse.gaps,
  ];

  return (
    <div className={`workspace-page ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Practice / Learning</p>
          <h1 className={styles.title}>
            Make room for <span>real work.</span>
          </h1>
          <p className={styles.introduction}>
            Build, rehearse and learn from feedback. Keep a record of the work you complete.
          </p>
        </div>
        <div className={styles.direction}>
          <span className={styles.directionMark} aria-hidden="true">
            <Target size={20} />
          </span>
          <div>
            <p className={styles.eyebrow}>Your direction</p>
            <p className={styles.directionName}>{direction}</p>
          </div>
        </div>
      </header>

      <div className={home.continue && simulation ? styles.focusGrid : styles.focusSingle}>
        {home.continue ? (
          <section className={styles.continuation}>
            <SectionHeading icon={MonitorPlay} eyebrow="Continue" title="Where you left off" />
            <div className={styles.currentWork}>
              {home.continue.kind === "run" ? (
                <ProjectCard run={home.continue.run} featured />
              ) : (
                <CommitmentsList commitments={[home.continue.commitment]} heading={null} />
              )}
            </div>
          </section>
        ) : null}

        {simulation ? (
          <section className={styles.simulation}>
            <div className={styles.simulationTop}>
              <p className={styles.eyebrow}>Explore a work simulation</p>
              <BookOpen size={18} aria-hidden="true" />
            </div>
            <h2>{simulation.title}</h2>
            <p className={styles.simulationDescription}>{simulation.description}</p>
            {simulation.experimental ? (
              <p className={styles.experimental}>Experimental · not yet practitioner-reviewed</p>
            ) : null}
            <Link href={simulation.href} className={styles.simulationLink}>
              View simulation <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </section>
        ) : null}
      </div>

      {/* Two or three substantial projects beat a pile of small ones. Each answers a problem
          organisations are dealing with now, cited, so the finished work reads as someone who
          can take such a problem on — the smaller gap-closing steps sit below. */}
      <section className={styles.flagships}>
        <SectionHeading
          icon={Target}
          eyebrow="Flagship projects"
          title={`Projects for ${direction}`}
        />
        <FlagshipProjects
          secondary={Boolean(home.continue)}
          flagships={flagships?.flagships ?? []}
          ideas={flagships?.ideas ?? []}
          refreshedAt={flagships?.refreshedAt ?? null}
          underWay={[...runs.map((run) => run.title), ...commitments.map((c) => c.title)]}
        />
      </section>

      <details className={`group ${styles.disclosure}`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold marker:hidden">
          <span>Browse other learning work</span>
          <span className="font-mono text-xs font-normal text-muted-foreground group-open:hidden">
            {inProgressCount + gapList.length + browse.finished.length} items
          </span>
          <span className="hidden font-mono text-xs font-normal text-muted-foreground group-open:inline">
            Close
          </span>
        </summary>
        <div className="grid gap-0 border-t border-border md:grid-cols-2 xl:grid-cols-3">
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

          <Panel title="Smaller steps: close one gap" count={gapList.length}>
            {gapList.length === 0 ? (
              <Empty>
                {report
                  ? "No other open gaps in your latest report."
                  : "Generate a career report to see the gaps it names."}
              </Empty>
            ) : (
              <div className="space-y-2">
                {gapList.map((gap) => (
                  <article key={gap.title} className="rounded-xl border border-border/60 p-3">
                    <h4 className="text-sm font-medium">{gap.title}</h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">{gap.detail}</p>
                    <ResourceLinks skill={gap.title} />
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
            {browse.finished.length > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Three or four strong projects, each with a README, a short walkthrough and a few
                posts, do more than twenty quiet ones. Package each from its finish review.
              </p>
            ) : null}
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
      </details>

      <details className={`group ${styles.disclosure}`}>
        <summary className="cursor-pointer list-none py-4 marker:hidden">
          <SectionHeading icon={Map} eyebrow="Longer plan" title="Where this leads" />
        </summary>
        <div className="border-t border-border py-5">
          <CareerBlueprint role={role} />
        </div>
      </details>
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
    <section className="border-b border-border p-4 last:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
      <h3 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
    <div className={styles.sectionHeading}>
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="text-base font-semibold">{title}</h2>
        {detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}
