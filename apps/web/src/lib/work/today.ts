import "server-only";

import {
  createAgentRunsRepository,
  createCareerProfilesRepository,
  createEvidenceRepository,
  createLabActionRequestsRepository,
  createWorkItemsRepository,
  type WorkItem,
} from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { getSetupState } from "@/lib/guidance/setup";
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

export type Today = {
  firstName: string;
  goal: TodayGoal;
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
  application: (id) => `/dashboard/applications?application=${id}`,
  document: (id) => `/dashboard/documents/${id}`,
  project: (id) => `/dashboard/learning?project=${id}`,
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

export async function getToday(
  userId: string,
  firstName: string,
  mode: CareerMode
): Promise<Today> {
  const db = getDatabase();
  const work = createWorkItemsRepository(db);

  const [goals, steps, receipts, lastRun, direction, pendingReview, labRequests, setup, findings] =
    await Promise.all([
      work.listGoals(userId),
      work.nextActions(userId, 4),
      work.listExecutions(userId, { limit: 4 }),
      createAgentRunsRepository(db).getLastFinishedRunForUser(userId),
      createCareerProfilesRepository(db).getActiveForUser(userId),
      createEvidenceRepository(db).countPendingReview(userId),
      createLabActionRequestsRepository(db).listPending(userId),
      getSetupState(userId, mode),
      createAgentRunsRepository(db).listUnseenForUser(userId, 3),
    ]);

  const activeGoal = goals.find((row) => row.status === "active") ?? goals[0];
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

  return {
    firstName,
    goal,
    otherGoals: goals
      .filter((row) => row.id !== activeGoal?.id)
      .map((row) => ({ id: row.id, title: row.title })),
    action,
    // At most three, and never a repeat of the primary action.
    alsoOpen: workActions.slice(1, 4),
    receipts: receipts.map((row) => ({
      id: row.id,
      action: row.action,
      status: row.status,
      receipt: row.receipt,
      error: row.error,
      atLabel: ago(row.finishedAt ?? row.startedAt),
    })),
    lastPassLabel: lastRun?.finishedAt ? ago(new Date(lastRun.finishedAt)) : null,
    suggestions: findings.slice(0, 3).map((finding) => ({
      label: finding.kind === "expired_saved_role" ? "Heads up" : "Fadi found",
      detail: finding.title,
      href: finding.href ?? "/dashboard",
    })),
    decisions,
  };
}
