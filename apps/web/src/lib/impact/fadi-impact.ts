import "server-only";

import {
  createApplicationsRepository,
  createCareerProfilesRepository,
  createJobsRepository,
  createSavedJobsRepository,
} from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { createJobScorer } from "@/lib/jobs/job-matching";

/**
 * Honest proof-of-value — the anti-gimmick surface. Every number here is REAL
 * (counted from the user's own data + the board), never invented. The only
 * derived figure is an explicitly-labelled time estimate using the industry
 * average of ~45 min per application (2026 market research).
 */

/** Industry average time spent per job application (used only for a labelled estimate). */
const MINUTES_PER_APPLICATION = 45;

export interface FadiImpact {
  /** YOUR tracked roles (saved/applied) whose postings closed — caught before more time went in. */
  deadPostingsHidden: number;
  /** Roles you saved that are off your active direction / above your level — flagged, not hidden. */
  offDirectionFlagged: number;
  /** Roles you've saved. */
  savedCount: number;
  /** Applications you've actually sent. */
  applicationsSent: number;
  /** Rough hours protected by NOT chasing the off-direction saves (labelled estimate). */
  estimatedHoursProtected: number;
  /** The active direction's role, for honest labelling. */
  targetRole: string | null;
}

export async function getFadiImpact(userId: string): Promise<FadiImpact> {
  const db = getDatabase();
  const [track, saved, applications] = await Promise.all([
    createCareerProfilesRepository(db).getActiveForUser(userId),
    createSavedJobsRepository(db).listForUser(userId),
    createApplicationsRepository(db).listForUser(userId),
  ]);

  const applicationsSent = applications.filter(
    (a) => a.appliedAt != null || a.status === "applied" || a.status === "interviewing" || a.status === "offer",
  ).length;

  // ONE fetch of every job THIS user tracked (saved ∪ applied) powers both metrics.
  const savedIds = saved.map((s) => s.jobId);
  const trackedIds = [
    ...new Set([...savedIds, ...applications.map((a) => a.jobId).filter((id): id is string => id != null)]),
  ];
  const jobRows = trackedIds.length > 0 ? await createJobsRepository(db).listByIds(trackedIds) : [];

  // Honesty rule: this is the USER's number, not a platform-wide one — only roles
  // they actually tracked whose postings then closed.
  const deadPostingsHidden = jobRows.filter(
    (j) => j.status === "closed" || j.status === "expired",
  ).length;

  // Off-direction saves: score the user's saved roles against the ACTIVE track and
  // count the ones Fadi flagged as off-role or above their level. Real, grounded.
  let offDirectionFlagged = 0;
  if (track?.targetRole && savedIds.length > 0) {
    const savedSet = new Set(savedIds);
    const scoreJob = createJobScorer({ careerProfile: track, resume: null });
    offDirectionFlagged = jobRows.filter((j) => {
      if (!savedSet.has(j.id)) return false;
      const m = scoreJob(j);
      return !m.onRole || m.overLevel;
    }).length;
  }

  return {
    deadPostingsHidden,
    offDirectionFlagged,
    savedCount: saved.length,
    applicationsSent,
    estimatedHoursProtected:
      Math.round(((offDirectionFlagged * MINUTES_PER_APPLICATION) / 60) * 10) / 10,
    targetRole: track?.targetRole ?? null,
  };
}
