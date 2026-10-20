/**
 * What the Learning home puts in front of someone: one thing to continue, one thing to
 * start next, and everything else behind Browse.
 *
 * The page used to show the running projects, the report's route, a grid of every gap,
 * a second generated plan and a commitments list side by side. Five planning surfaces
 * made the person do the choosing Fadi is there to do. The same data now feeds one
 * decision per slot; nothing is deleted, the rest is one click down.
 *
 * Pure, so the ordering rules are pinned by tests rather than by whoever last edited the
 * page.
 */

export type PracticeRun = {
  id: string;
  title: string;
  status: string;
  commitmentId: string | null;
  steps: Array<{ ordinal: number; title: string; status: string }>;
};

export type PracticeCommitment = {
  id: string;
  gap: string;
  title: string;
  kind: string;
  status: string;
};

export type PracticeGap = { title: string; detail: string };

export type ContinueItem<
  R extends PracticeRun = PracticeRun,
  C extends PracticeCommitment = PracticeCommitment,
> =
  | { kind: "run"; run: R; next: { ordinal: number; title: string } | null; total: number }
  | { kind: "commitment"; commitment: C };

export type Recommendation =
  | { kind: "gap"; gap: PracticeGap; routeStep: number | null }
  /**
   * No gap to point at: either there is no report yet, or every gap it named already has
   * work against it. The blueprint reads the current direction itself, so neither case is
   * a dead end and neither asks for a report first.
   */
  | { kind: "blueprint"; reason: "no-report" | "all-covered" };

export type PracticeHome<
  R extends PracticeRun = PracticeRun,
  C extends PracticeCommitment = PracticeCommitment,
> = {
  continue: ContinueItem<R, C> | null;
  recommended: Recommendation;
  browse: {
    runs: R[];
    commitments: C[];
    gaps: PracticeGap[];
    finished: string[];
  };
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

const isActiveRun = (r: PracticeRun) => r.status !== "done" && r.status !== "abandoned";

/**
 * @param runs oldest first, as the repository lists them
 * @param commitments newest first, as the repository lists them
 */
export function buildPracticeHome<R extends PracticeRun, C extends PracticeCommitment>(input: {
  runs: R[];
  commitments: C[];
  gaps: PracticeGap[];
  route: Array<{ title: string }>;
}): PracticeHome<R, C> {
  const runs = input.runs.filter((r) => r.status !== "abandoned");
  const activeRuns = runs.filter(isActiveRun).reverse();

  // A commitment with a project behind it is that project. Showing both is the two
  // finish lines the completion fix closed; the title match covers runs planned before
  // runs carried their commitment id.
  const runCommitmentIds = new Set(runs.map((r) => r.commitmentId).filter(Boolean));
  const runTitles = new Set(runs.map((r) => norm(r.title)));
  const hasRun = (c: PracticeCommitment) =>
    runCommitmentIds.has(c.id) || runTitles.has(norm(c.title));

  const openCommitments = input.commitments.filter((c) => c.status === "committed" && !hasRun(c));

  let current: ContinueItem<R, C> | null = null;
  if (activeRuns[0]) {
    const run = activeRuns[0];
    const next = run.steps.find((s) => s.status === "pending") ?? null;
    current = {
      kind: "run",
      run,
      next: next ? { ordinal: next.ordinal, title: next.title } : null,
      total: run.steps.length,
    };
  } else if (openCommitments[0]) {
    current = { kind: "commitment", commitment: openCommitments[0] };
  }

  // A gap is covered once something is being done about it, finished or not.
  const coveredGaps = new Set(
    input.commitments
      .filter((c) => c.status === "committed" || c.status === "completed")
      .map((c) => norm(c.gap))
  );
  const openGaps = input.gaps.filter((g) => !coveredGaps.has(norm(g.title)));

  let recommended: Recommendation;
  if (openGaps[0]) {
    const gap = openGaps[0];
    const index = input.route.findIndex((step) => norm(step.title) === norm(gap.title));
    recommended = { kind: "gap", gap, routeStep: index === -1 ? null : index + 1 };
  } else {
    recommended = {
      kind: "blueprint",
      reason: input.gaps.length === 0 ? "no-report" : "all-covered",
    };
  }

  const finished = [
    ...runs.filter((r) => r.status === "done").map((r) => r.title),
    ...input.commitments.filter((c) => c.status === "completed" && !hasRun(c)).map((c) => c.title),
  ];

  const continuingId = current?.kind === "commitment" ? current.commitment.id : null;

  return {
    continue: current,
    recommended,
    browse: {
      runs: current?.kind === "run" ? activeRuns.slice(1) : activeRuns,
      commitments: openCommitments.filter((c) => c.id !== continuingId),
      gaps: recommended.kind === "gap" ? openGaps.slice(1) : [],
      finished: [...new Set(finished)],
    },
  };
}
