import "server-only";

import {
  createAgentRunsRepository,
  createCareerProfilesRepository,
  createJobsRepository,
  createProfilesRepository,
  createSavedJobsRepository,
  type CreateFindingInput,
} from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { getMarketIntelligence } from "@/lib/data-sources/service";
import { ensureFreshLiveJobs } from "@/lib/jobs/sync";
import { getRecommendedJobsForUser } from "@/lib/jobs/data";
import { createJobScorer } from "@/lib/jobs/job-matching";
import { offTrackPatternFinding } from "@/lib/guardian/patterns";
import type { EmploymentType, WorkMode } from "@/lib/jobs/filters";
import { parseLocation } from "@/lib/jobs/locations";
import { logger } from "@/lib/observability/logger";

/**
 * Fadi's background agency — the pass Fadi makes over a user's market without
 * them asking. Everything it learns is written as agent_findings rows, and the
 * "since you were away" digest is composed ONLY from those rows: Fadi never
 * claims background work that isn't on this ledger.
 *
 * Triggered two ways, same code path:
 *  - the cron route (/api/agent/run) on a schedule
 *  - opportunistically on dashboard load when the last run is old
 *    (so the agency is real even on deployments with no cron infra).
 */

/** Re-run throttle: a user gets at most one run per this window. */
const RUN_TTL_MS = 6 * 60 * 60 * 1000; // 6h
/** A "running" row older than this is treated as crashed, not in-flight. */
const RUN_STUCK_MS = 30 * 60 * 1000;
/** First run has no baseline — only call things "new" from the last day. */
const FIRST_RUN_WINDOW_MS = 24 * 60 * 60 * 1000;

const MAX_NEW_ROLE_FINDINGS = 3;
const MAX_SIGNAL_FINDINGS = 2;
const SIGNAL_RELEVANCE_BAR = 40;

export type AgentRunOutcome =
  | { ran: true; findings: number }
  | { ran: false; reason: "no_track" | "too_soon" | "in_flight" | "error" };

export async function runAgentForUser(userId: string): Promise<AgentRunOutcome> {
  const db = getDatabase();
  const runsRepo = createAgentRunsRepository(db);

  const track = await createCareerProfilesRepository(db).getActiveForUser(userId);
  if (!track?.targetRole) return { ran: false, reason: "no_track" };

  const lastRun = await runsRepo.getLastRunForUser(userId);
  if (lastRun) {
    const age = Date.now() - new Date(lastRun.startedAt).getTime();
    if (lastRun.status === "running" && age < RUN_STUCK_MS) {
      return { ran: false, reason: "in_flight" };
    }
    if (lastRun.status !== "running" && age < RUN_TTL_MS) {
      return { ran: false, reason: "too_soon" };
    }
  }

  const lastFinished = await runsRepo.getLastFinishedRunForUser(userId);
  const baseline = lastFinished?.finishedAt
    ? new Date(lastFinished.finishedAt)
    : new Date(Date.now() - FIRST_RUN_WINDOW_MS);

  const run = await runsRepo.startRun(userId);

  try {
    const relevanceProfile = {
      targetRole: track.targetRole,
      skills: [],
      skillGaps: [],
      region: track.location,
      domain: track.domain,
    };

    // 1. Pull fresh postings into the jobs table (TTL-guarded, best-effort).
    await ensureFreshLiveJobs(relevanceProfile);

    // Recent findings, for dedupe — never report the same thing twice.
    const recent = await runsRepo.listRecentForUser(userId, 30);
    const seenJobIds = new Set(
      recent.map((f) => f.data?.jobId).filter((id): id is string => typeof id === "string"),
    );
    const seenTitles = new Set(recent.map((f) => f.title));

    const findings: CreateFindingInput[] = [];

    // 2. New matched roles since the baseline — reuses the full recommendation
    //    pipeline (relevance gating included), so the agent's bar for "worth
    //    telling you" is the same one the jobs page uses. Scope (a user setting):
    //    "filters" (default) searches their location + saved modes/types, so every
    //    finding matches what they'd see on their board; "broad" surfaces on-role
    //    roles anywhere.
    const prefs = (await createProfilesRepository(db).getByUserId(userId))?.jobPreferences ?? {};
    const scope = prefs.agentScope ?? "filters";
    const loc = prefs.location ?? parseLocation(track.location);
    const recommended =
      scope === "broad"
        ? await getRecommendedJobsForUser(userId, 30)
        : await getRecommendedJobsForUser(userId, 30, {
            country: loc.country?.toLowerCase(),
            city: loc.city,
            modes: (prefs.modes ?? []) as WorkMode[],
            types: (prefs.types ?? []) as EmploymentType[],
          });
    const newRoles = recommended
      .filter(
        (j) =>
          !j.isSaved &&
          !j.applicationStatus &&
          new Date(j.firstSeenAt).getTime() > baseline.getTime() &&
          !seenJobIds.has(j.id),
      )
      .slice(0, MAX_NEW_ROLE_FINDINGS);

    for (const job of newRoles) {
      findings.push({
        kind: "new_role",
        title: `${job.title} at ${job.company}`,
        detail: job.matchReason,
        // Deep-link to THIS job's workspace — it loads the job by id regardless of
        // the board's location filter, so clicking always opens the actual role
        // (the generic /dashboard/jobs could be filtered to a city the job isn't in).
        href: `/dashboard/applications/${job.id}/workspace`,
        data: { jobId: job.id, matchScore: job.matchScore },
      });
    }

    // 3. Saved/applied roles whose posting has gone stale — bad news, but the
    //    honest kind: it saves the user from investing in a dead posting.
    const savedJobs = await createSavedJobsRepository(db).listForUser(userId);
    if (savedJobs.length > 0) {
      const jobRows = await createJobsRepository(db).listByIds(savedJobs.map((s) => s.jobId));
      const expired = jobRows.filter(
        (j) =>
          j.status !== "active" &&
          new Date(j.updatedAt).getTime() > baseline.getTime() &&
          !seenTitles.has(`${j.title} at ${j.company} looks closed`),
      );
      for (const job of expired) {
        findings.push({
          kind: "expired_saved_role",
          title: `${job.title} at ${job.company} looks closed`,
          detail:
            "This posting stopped appearing on its source boards. Worth verifying before spending more time on it — and no, that's not on you.",
          href: "/dashboard/applications",
          data: { jobId: job.id },
        });
      }

      // Pattern guardian (proactive): are the roles being saved drifting from the
      // active direction? One supportive nudge per window (deduped on the kind),
      // grounded in the user's REAL saved roles — never a guess.
      if (!recent.some((f) => f.kind === "off_track")) {
        const scoreJob = createJobScorer({ careerProfile: track, resume: null });
        const active = jobRows.filter((j) => j.status === "active");
        const offTrack = active.filter((j) => {
          const m = scoreJob(j);
          return !m.onRole || m.overLevel;
        }).length;
        const pattern = offTrackPatternFinding({
          offTrackCount: offTrack,
          savedTotal: active.length,
          targetRole: track.targetRole,
        });
        if (pattern) {
          findings.push({
            kind: "off_track",
            title: pattern.title,
            detail: pattern.detail,
            href: "/dashboard/jobs",
            data: {},
          });
        }
      }
    }

    // 4. Market signals scored against this user's profile.
    const intel = await getMarketIntelligence(relevanceProfile, { limit: 6 });
    const signals = intel.signals
      .filter((s) => s.relevance >= SIGNAL_RELEVANCE_BAR && !seenTitles.has(s.title))
      .slice(0, MAX_SIGNAL_FINDINGS);
    for (const signal of signals) {
      findings.push({
        // News-class signals are the world-shift channel (geopolitics, macro,
        // industry moves); the rest are routine market activity.
        kind: signal.kind === "news" ? "world_shift" : "market_signal",
        title: signal.title,
        detail: signal.reasons[0] ?? "Relevant activity in your target market.",
        href: signal.url ?? "/dashboard",
        data: { kind: signal.kind, relevance: signal.relevance },
      });
    }

    await runsRepo.insertFindings(run.id, userId, findings);
    await runsRepo.finishRun(run.id, { status: "ok", findingsCount: findings.length });

    logger.info("agent.run_completed", { userId, findings: findings.length });
    return { ran: true, findings: findings.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    await runsRepo
      .finishRun(run.id, { status: "error", findingsCount: 0, error: message })
      .catch(() => {});
    logger.error("agent.run_failed", { userId, error: message });
    return { ran: false, reason: "error" };
  }
}

/**
 * Fire-and-forget trigger for page loads: runs only when the last run is old,
 * and never blocks rendering. Callers wrap it in `after()` (next/server).
 */
export async function maybeRunAgentForUser(userId: string): Promise<void> {
  try {
    await runAgentForUser(userId);
  } catch (err) {
    logger.error("agent.opportunistic_run_failed", {
      userId,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}
