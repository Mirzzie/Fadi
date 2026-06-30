import "server-only";

import {
  createApplicationsRepository,
  createCareerProfilesRepository,
  createCareerReportsRepository,
  createResumesRepository,
  createSavedJobsRepository,
} from "@careeros/database";

import { getDatabase } from "@/lib/database/client";

/**
 * The OS guidance layer — "what should I do next?" computed from the user's
 * REAL state, not a static tour. This is how FadiOS turns a login into a
 * guided path: personalize → analyze → discover → act. Each step is gated on a
 * concrete artifact existing, so completion is honest (no fake checkmarks).
 */

export type SetupStep = {
  id: string;
  title: string;
  /** Fadi-voiced one-liner on why this matters / what to do. */
  description: string;
  href: string;
  cta: string;
  done: boolean;
};

export type SetupState = {
  steps: SetupStep[];
  completed: number;
  total: number;
  percent: number;
  /** The single next thing to do — the OS's recommendation. */
  nextStep: SetupStep | null;
  allDone: boolean;
  /** Discovery suggestion (not part of the completion count). */
  exploreNiche: { suggested: boolean; href: string };
};

export async function getSetupState(userId: string): Promise<SetupState> {
  const db = getDatabase();

  // Active direction first, so the report check below is for THIS track.
  const track = await createCareerProfilesRepository(db).getActiveForUser(userId);
  const [resume, report, savedJobs, applications, allTracks] = await Promise.all([
    createResumesRepository(db).getLatestForTrack(userId, track?.id ?? null),
    createCareerReportsRepository(db).getLatestReadyForUser(userId, track?.id ?? null),
    createSavedJobsRepository(db).listForUser(userId),
    createApplicationsRepository(db).listForUser(userId),
    createCareerProfilesRepository(db).listForUser(userId),
  ]);

  const hasResumeText = Boolean(resume?.parsedText?.trim() || resume?.rawText?.trim());

  const steps: SetupStep[] = [
    {
      id: "direction",
      title: "Set your direction",
      description: track
        ? `You're aimed at ${track.label?.trim() || track.targetRole}. Switch or add a track anytime from the top bar.`
        : "Tell me the role or field you're aiming for so I can tailor everything to it.",
      href: "/dashboard/profile",
      cta: track ? "Review" : "Set direction",
      done: Boolean(track),
    },
    {
      id: "cv",
      title: "Add your CV",
      description: hasResumeText
        ? "Your CV is in — I'm using it to match roles and write documents."
        : "Paste your CV text so I can ground job matches and tailor your documents to evidence, not guesses.",
      href: "/dashboard/profile",
      cta: "Add CV",
      done: hasResumeText,
    },
    {
      id: "report",
      title: "Generate your Career Report",
      description: report
        ? "Your Career Intelligence Report is ready — your strengths, gaps, and next moves."
        : "Get your honest strengths, skill gaps, and a plan grounded in real labour-market data.",
      href: "/dashboard",
      cta: "Generate",
      done: Boolean(report),
    },
    {
      id: "save-role",
      title: "Save a role worth pursuing",
      description:
        savedJobs.length > 0
          ? `You've saved ${savedJobs.length} role${savedJobs.length === 1 ? "" : "s"}. I'll keep watching your market.`
          : "Browse the live roles I've matched to you and save one that fits — that's where momentum starts.",
      href: "/dashboard/jobs",
      cta: "See jobs",
      done: savedJobs.length > 0,
    },
    {
      id: "apply",
      title: "Track your first application",
      description:
        applications.length > 0
          ? `${applications.length} application${applications.length === 1 ? "" : "s"} in motion. Score the process, not just the outcome.`
          : "When you apply, log it here — we measure the effort you control, not just replies.",
      href: "/dashboard/applications",
      cta: "Open tracker",
      done: applications.length > 0,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const nextStep = steps.find((s) => !s.done) ?? null;

  return {
    steps,
    completed,
    total,
    percent: Math.round((completed / total) * 100),
    nextStep,
    allDone: completed === total,
    // Suggest the Niche Finder when the user hasn't branched out yet — the
    // "I'm not sure which path" moment is exactly who it's for.
    exploreNiche: { suggested: allTracks.length <= 1, href: "/dashboard/niche-finder" },
  };
}
