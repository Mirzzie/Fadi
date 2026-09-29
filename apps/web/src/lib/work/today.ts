import "server-only";

import {
  createOutboxRepository,
  createAgentRunsRepository,
  createCareerProfilesRepository,
  createEvidenceRepository,
  createLabActionRequestsRepository,
  createWorkItemsRepository,
  type WorkItem,
} from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { getSetupState } from "@/lib/guidance/setup";
import { planSteps, proposedPlan, runningPlan } from "./run-plan";
import type { CareerMode } from "@/app/dashboard/mode";

/**
 * Today answers four questions, in this order:
 *
 *   1. What am I trying to achieve?
 *   2. What should I do next?
 *   3. What has Fadi been doing?
 *   4. What needs my decision?
 *
 * Everything here is read from something that already happened. When there is no answer the
 * page says so — an empty "what Fadi did" list is the truth, and better than a filled one
 * that nobody can trace back to a real attempt.
 */

export type TodayGoal = {
  id: string | null;
  title: string;
  reason: string;
  /** Where the goal came from: the person's own goal, or the direction they chose. */
  source: "goal" | "direction" | "none";
};

export type TodayAction = {
  /** A work item id when this is real work, null when it comes from the setup path. */
  id: string | null;
  title: string;
  reason: string;
  href: string;
  cta: string;
  /** Formatted on the server: a date rendered by the browser's locale never matches the
   *  server's, and the mismatch costs a hydration pass on the first screen. */
  dueLabel: string | null;
  started: boolean;
};

export type TodayReceipt = {
  id: string;
  action: string;
  status: string;
  receipt: string;
  error: string | null;
  atLabel: string;
};

export type TodayDecision = {
  id: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
};

export type TodaySuggestion = { label: string; detail: string; href: string };

/** A step of the plan Fadi is in the middle of, as the person watches it go. */
export type TodayPlanStep = {
  id: string;
  title: string;
  reason: string;
  /** open | active | blocked | done — `blocked` carries why in `note`. */
  status: string;
  /** Whether Fadi can do this one, or it is the person's to do. */
  automatic: boolean;
  /** What the step found or produced, once it has run. */
  outcome: string;
  /** What it left behind, linked — a step that drafted a CV you cannot open is half a step. */
  output: { label: string; href: string } | null;
  note: string;
};

export type TodayPlan = {
  id: string;
  title: string;
  steps: TodayPlanStep[];
  /** True when the next thing to happen is Fadi's, not the person's. */
  fadiCanContinue: boolean;
};

export type Today = {
  firstName: string;
  goal: TodayGoal;
  /** The plan in flight, when there is one. This is what "Fadi is working" shows. */
  plan: TodayPlan | null;
  /** A plan Fadi has laid out and not started. One press from running, one from gone. */
  proposal: { id: string; title: string; steps: number } | null;
  otherGoals: { id: string; title: string }[];
  action: TodayAction | null;
  alsoOpen: TodayAction[];
  receipts: TodayReceipt[];
  lastPassLabel: string | null;
  decisions: TodayDecision[];
  suggestions: TodaySuggestion[];
};

/** A step is only worth offering when a person can tell why they are being asked to do it. */
function toAction(item: WorkItem): TodayAction {
  return {
    id: item.id,
    title: item.title,
    reason: item.reason || item.detail,
    href: hrefForRefs(item.refs),
    cta: "Open",
    dueLabel: item.dueAt ? `Due ${ago(item.dueAt)}` : null,
    started: item.status === "active",
  };
}

const REF_ROUTES: Record<string, (id: string) => string> = {
  job: (id) => `/dashboard/jobs?job=${id}`,
  application: () => "/dashboard/applications",
  application_workspace: (id) => `/dashboard/applications/${id}/workspace`,
  document: (id) => `/dashboard/documents/${id}`,
  project: (id) => `/dashboard/learning/projects/${id}`,
  project_run: (id) => `/dashboard/learning/projects/${id}`,
  interview_session: (id) => `/dashboard/interview?sessionId=${id}`,
  evidence: () => "/dashboard/evidence",
  portfolio: () => "/dashboard/portfolio",
};

/** Plain relative time, computed once on the server so both renders agree. */
function ago(when: Date): string {
  const minutes = Math.round((Date.now() - when.getTime()) / 60_000);
  if (minutes <= -1440) return `in ${Math.round(-minutes / 1440)} days`;
  if (minutes < -1) return `in ${Math.round(-minutes / 60) || 1} hours`;
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function hrefForRefs(refs: WorkItem["refs"]): string {
  for (const ref of refs) {
    const route = REF_ROUTES[ref.type];
    if (route) return route(ref.id);
  }
  return "/dashboard";
}

/** What a queued follow-up is, in the person's terms. */
const HANDOFF_LABEL: Record<string, string> = {
  "learning.completed": "Adding a finished project to your plan",
  "application.changed": "Updating an application in your plan",
  "application.outcome": "Turning a rejection into a next step",
  "interview.completed": "Turning a practice interview into a next step",
};

export async function getToday(
  userId: string,
  firstName: string,
  mode: CareerMode
): Promise<Today> {
  const db = getDatabase();
  const work = createWorkItemsRepository(db);

  // The goals first: "what should I do next" is only true relative to the goal the person is
  // on, so the active goal has to be known before the next actions can be asked for.
  const goals = await work.listGoals(userId);
  const activeGoal = goals.find((row) => row.status === "active") ?? goals[0];

  const inFlight = await runningPlan(userId);
  const waiting = inFlight ? undefined : await proposedPlan(userId);
  const waitingSteps = waiting ? await planSteps(userId, waiting.id) : [];
  const planRows = inFlight ? await planSteps(userId, inFlight.id) : [];
  const planOutputs = inFlight
    ? await createWorkItemsRepository(db).listOutputs(userId, { kind: "document" })
    : [];

  const [
    steps,
    receipts,
    lastRun,
    direction,
    pendingReview,
    labRequests,
    setup,
    findings,
    handoffs,
  ] = await Promise.all([
    activeGoal ? work.nextActions(userId, { goalId: activeGoal.id, limit: 4 }) : [],
    work.listExecutions(userId, { limit: 4 }),
    createAgentRunsRepository(db).getLastFinishedRunForUser(userId),
    createCareerProfilesRepository(db).getActiveForUser(userId),
    createEvidenceRepository(db).countPendingReview(userId),
    createLabActionRequestsRepository(db).listPending(userId),
    getSetupState(userId, mode),
    createAgentRunsRepository(db).listUnseenForUser(userId, 3),
    createOutboxRepository(db).listUnsettled(userId, 5),
  ]);

  const goal: TodayGoal = activeGoal
    ? {
        id: activeGoal.id,
        title: activeGoal.title,
        reason: activeGoal.reason || activeGoal.detail,
        source: "goal",
      }
    : direction
      ? {
          id: null,
          title: direction.label?.trim() || direction.targetRole,
          reason: direction.careerGoal ?? "",
          source: "direction",
        }
      : { id: null, title: "", reason: "", source: "none" };

  // Real work wins. The setup path is the fallback for someone who has not set any work yet —
  // it is computed from their actual state, so it is a real next step, not a tour.
  const workActions = steps.map(toAction);
  const action: TodayAction | null =
    workActions[0] ??
    (setup.nextStep
      ? {
          id: null,
          title: setup.nextStep.title,
          reason: setup.nextStep.description,
          href: setup.nextStep.href,
          cta: setup.nextStep.cta,
          dueLabel: null,
          started: false,
        }
      : null);

  const decisions: TodayDecision[] = [
    ...(pendingReview > 0
      ? [
          {
            id: "evidence-review",
            title:
              pendingReview === 1
                ? "One import is waiting on you"
                : `${pendingReview} imports are waiting on you`,
            detail: "Fadi could not tell whether these are the same thing you already have.",
            href: "/dashboard/evidence",
            cta: "Review them",
          },
        ]
      : []),
    ...labRequests.map((request) => ({
      id: request.id,
      title: "Fadi is asking to run something",
      detail: request.summary,
      href: "/dashboard/learning",
      cta: "Decide",
    })),
  ];

  const planStepViews: TodayPlanStep[] = planRows.map((row) => ({
    id: row.id,
    title: row.title,
    reason: row.reason,
    status: row.status,
    automatic: row.refs.some((ref) => ref.type === "capability"),
    outcome: row.status === "done" ? row.detail : "",
    output: (() => {
      const made = planOutputs.find((item) => item.workItemId === row.id);
      return made ? { label: "Open it", href: `/dashboard/documents/${made.refId}` } : null;
    })(),
    // `reason` carries the capability's own words when a step stopped, so it is shown as the
    // note rather than the template's explanation of why the step exists.
    note: row.status === "blocked" ? row.reason : "",
  }));
  const nextInPlan = planStepViews.find(
    (step) => step.status === "open" || step.status === "active"
  );

  return {
    firstName,
    goal,
    proposal: waiting ? { id: waiting.id, title: waiting.title, steps: waitingSteps.length } : null,
    plan: inFlight
      ? {
          id: inFlight.id,
          title: inFlight.title,
          steps: planStepViews,
          fadiCanContinue: Boolean(nextInPlan?.automatic),
        }
      : null,
    otherGoals: goals
      .filter((row) => row.id !== activeGoal?.id)
      .map((row) => ({ id: row.id, title: row.title })),
    action,
    // At most three, and never a repeat of the primary action.
    alsoOpen: workActions.slice(1, 4),
    receipts: [
      // A follow-up that has failed at least once is shown, so a retry is never silent. One
      // still on its first try is simply in progress and not worth a line.
      ...handoffs
        .filter((row) => row.status === "failed" || row.attempts > 0)
        .map((row) => ({
          id: row.id,
          action: HANDOFF_LABEL[row.topic] ?? "Follow-up",
          status: row.status === "failed" ? "failed" : "retrying",
          receipt: "",
          error: row.status === "failed" ? "Fadi gave up after several tries." : null,
          atLabel: ago(row.createdAt),
        })),
      ...receipts.map((row) => ({
        id: row.id,
        action: row.action,
        status: row.status,
        receipt: row.receipt,
        error: row.error,
        atLabel: ago(row.finishedAt ?? row.startedAt),
      })),
    ],
    lastPassLabel: lastRun?.finishedAt ? ago(new Date(lastRun.finishedAt)) : null,
    suggestions: findings.slice(0, 3).map((finding) => ({
      label: finding.kind === "expired_saved_role" ? "Heads up" : "Fadi found",
      detail: finding.title,
      href: finding.href ?? "/dashboard",
    })),
    decisions,
  };
}
