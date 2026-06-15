import {
  createAgentRunsRepository,
  createCareerProfilesRepository,
  createCareerReportsRepository,
  createLinkedInProfilesRepository,
  createProfilesRepository,
  createResumesRepository,
  createSavedJobsRepository,
} from "@careeros/database";

import { composeCareerEvidence } from "@/lib/career/evidence";
import { getDatabase } from "@/lib/database/client";
import { getMarketIntelligence } from "@/lib/data-sources/service";
import { getMomentumSummary } from "@/lib/resilience/service";

import type { FadiUserContext } from "./types";

export interface BuildFadiContextOptions {
  /**
   * Fetch live market signals from external sources. Adds network latency, so
   * it's OFF by default (the per-message chat path stays fast). The dashboard
   * brief and scheduled refresh pass `true`. Once the cached `market_signals`
   * store lands, the chat path can read cached signals and flip this on.
   */
  includeLiveMarket?: boolean;
}

function truncate(text: string | null | undefined, max: number): string | null {
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max)}\n[truncated for context]` : text;
}

export async function buildFadiContext(
  userId: string,
  options: BuildFadiContextOptions = {},
): Promise<FadiUserContext | null> {
  const db = getDatabase();

  const [careerProfile, profile, resume, linkedIn, report, savedJobsList, momentum, findings] =
    await Promise.all([
      createCareerProfilesRepository(db).getActiveForUser(userId),
      createProfilesRepository(db).getByUserId(userId),
      createResumesRepository(db).getLatestForUser(userId),
      createLinkedInProfilesRepository(db).getLatestForUser(userId),
      createCareerReportsRepository(db).getLatestReadyForUser(userId),
      createSavedJobsRepository(db).listForUser(userId),
      getMomentumSummary(userId),
      createAgentRunsRepository(db).listRecentForUser(userId, 8),
    ]);

  if (!careerProfile) return null;

  // Live, personalized market intelligence — opt-in (see options doc above).
  const skillGaps = (report?.missingSkills as Array<{ title: string; detail: string }>) ?? [];
  let marketContext: FadiUserContext["marketContext"] = {
    available: false,
    note: "Live market intelligence is available but not loaded for this turn (kept off to keep chat fast). The dashboard market brief shows the full picture.",
    signals: [],
  };

  if (options.includeLiveMarket) {
    const intel = await getMarketIntelligence({
      targetRole: careerProfile.targetRole,
      skills: ((report?.strengths as Array<{ title: string }>) ?? []).map((s) => s.title),
      skillGaps: skillGaps.map((g) => g.title),
      region: careerProfile.location,
    });

    marketContext = {
      available: intel.signals.length > 0,
      note:
        intel.signals.length > 0
          ? "Live signals below are already scored for relevance to this user. Use them for honest context — never to alarm."
          : "No live market signals currently clear the relevance threshold for this user's profile.",
      signals: intel.signals.map((s) => ({
        title: s.title,
        url: s.url,
        kind: s.kind,
        relevance: s.relevance,
        reason: s.reasons[0] ?? "relevant to your profile",
      })),
    };
  }

  return {
    userId,

    profile: {
      fullName: profile?.fullName ?? null,
      email: profile?.email ?? null,
      targetRole: careerProfile.targetRole,
      experienceLevel: careerProfile.experienceLevel,
      locationPreference: careerProfile.location,
      careerGoals: careerProfile.careerGoal,
    },

    evidence: {
      resumeText: truncate(resume?.parsedText ?? resume?.rawText, 8000),
      linkedInText: truncate(linkedIn?.rawText ?? linkedIn?.profileUrl, 4000),
      hasResume: Boolean(resume?.rawText ?? resume?.parsedText),
      hasLinkedIn: Boolean(linkedIn?.rawText ?? linkedIn?.profileUrl),
    },

    analysis: {
      hasReport: Boolean(report),
      generatedAt: report?.generatedAt
        ? new Date(report.generatedAt).toISOString()
        : report?.createdAt
          ? new Date(report.createdAt).toISOString()
          : null,
      careerReadinessScore: report?.careerReadinessScore ?? null,
      resumeQualityScore: report?.resumeQualityScore ?? null,
      careerSummary: report?.careerSummary ?? null,
      strengths: (report?.strengths as Array<{ title: string; detail: string }>) ?? [],
      skillGaps: (report?.missingSkills as Array<{ title: string; detail: string }>) ?? [],
      targetRoleFit:
        (report?.targetRoleFit as { rating?: string; explanation?: string } | null) ?? null,
      recommendedActions:
        (report?.recommendedActions as Array<{ title: string; detail: string }>) ?? [],
      learningPath:
        (report?.recommendedLearningPath as Array<{ title: string; detail: string }>) ?? [],
    },

    opportunities: {
      savedJobsCount: savedJobsList.length,
      activeApplicationsCount: savedJobsList.filter(
        (j) => j.status !== "saved" && j.status !== "rejected",
      ).length,
      savedJobs: savedJobsList.slice(0, 10).map((j) => ({
        title: "Saved role",
        company: "Company",
        matchScore: j.matchScore,
        status: j.status,
      })),
    },

    marketContext,

    backgroundFindings: findings.map((f) => ({
      kind: f.kind,
      title: f.title,
      detail: f.detail,
      foundAt: new Date(f.createdAt).toISOString(),
    })),

    momentum: {
      available: true,
      score: momentum.momentum,
      band: momentum.band,
      bandMessage: momentum.bandMessage,
      isResting: momentum.isResting,
      cadenceTarget: momentum.cadenceTarget,
      cadencePeriod: momentum.cadencePeriod,
      cadenceMessage: momentum.cadenceMessage,
      qualityApplicationsThisPeriod: momentum.qualityApplicationsThisPeriod,
    },
  };
}

export function formatFadiContextAsPrompt(ctx: FadiUserContext): string {
  const lines: string[] = [];

  lines.push("# User Career Context");
  lines.push("");
  lines.push("## Profile");
  lines.push(`Name: ${ctx.profile.fullName ?? "Not provided"}`);
  lines.push(`Target role: ${ctx.profile.targetRole ?? "Not specified"}`);
  lines.push(`Experience level: ${ctx.profile.experienceLevel ?? "Not specified"}`);
  lines.push(`Location preference: ${ctx.profile.locationPreference ?? "Not specified"}`);
  lines.push(`Career goals: ${ctx.profile.careerGoals ?? "Not provided"}`);

  lines.push("");
  lines.push("## Career Evidence");
  // LinkedIn (the full record) is the source of truth; a resume is a role-tailored
  // excerpt. composeCareerEvidence enforces that hierarchy + the honest labels.
  lines.push(
    composeCareerEvidence({
      resumeText: ctx.evidence.resumeText,
      linkedInText: ctx.evidence.linkedInText,
    }).block,
  );

  if (ctx.analysis.hasReport) {
    lines.push("");
    lines.push("## Career Intelligence Analysis");
    lines.push(
      `Generated: ${ctx.analysis.generatedAt ? new Date(ctx.analysis.generatedAt).toLocaleDateString() : "recently"}`,
    );
    lines.push(`Career readiness score: ${ctx.analysis.careerReadinessScore ?? "N/A"}/100`);
    lines.push(`Resume quality score: ${ctx.analysis.resumeQualityScore ?? "N/A"}/100`);

    if (ctx.analysis.careerSummary) {
      lines.push(`Summary: ${ctx.analysis.careerSummary}`);
    }

    if (ctx.analysis.strengths.length > 0) {
      lines.push(
        `Key strengths: ${ctx.analysis.strengths.map((s) => s.title).join(", ")}`,
      );
    }

    if (ctx.analysis.skillGaps.length > 0) {
      lines.push(
        `Skill gaps: ${ctx.analysis.skillGaps.map((g) => g.title).join(", ")}`,
      );
    }

    if (ctx.analysis.targetRoleFit) {
      lines.push(
        `Target role fit: ${ctx.analysis.targetRoleFit.rating ?? "unknown"} — ${ctx.analysis.targetRoleFit.explanation ?? ""}`,
      );
    }

    if (ctx.analysis.recommendedActions.length > 0) {
      lines.push("Recommended next actions:");
      ctx.analysis.recommendedActions.forEach((a) => lines.push(`  - ${a.title}: ${a.detail}`));
    }

    if (ctx.analysis.learningPath.length > 0) {
      lines.push("Learning path:");
      ctx.analysis.learningPath.forEach((l) => lines.push(`  - ${l.title}`));
    }
  } else {
    lines.push("");
    lines.push("## Career Analysis");
    lines.push("No Career Intelligence Report has been generated yet.");
  }

  lines.push("");
  lines.push("## Active Opportunities");
  lines.push(`Saved jobs: ${ctx.opportunities.savedJobsCount}`);
  lines.push(`Active applications: ${ctx.opportunities.activeApplicationsCount}`);

  if (ctx.opportunities.savedJobs.length > 0) {
    ctx.opportunities.savedJobs.forEach((j) => {
      lines.push(
        `  - ${j.title} at ${j.company} (match: ${j.matchScore ?? "?"}%, status: ${j.status})`,
      );
    });
  }

  lines.push("");
  lines.push("## Live Market Context");
  lines.push(ctx.marketContext.note);
  if (ctx.marketContext.signals.length > 0) {
    ctx.marketContext.signals.forEach((s) => {
      lines.push(`  - [${s.kind}] ${s.title}${s.url ? ` (${s.url})` : ""} — ${s.reason}`);
    });
  }

  lines.push("");
  lines.push("## Background Agency Findings");
  if (ctx.backgroundFindings.length > 0) {
    lines.push(
      "Your background runs found these (the ONLY background work you may claim — cite them by what they are):",
    );
    ctx.backgroundFindings.forEach((f) => {
      lines.push(
        `  - [${f.kind}] ${f.title}${f.detail ? ` — ${f.detail}` : ""} (found ${new Date(f.foundAt).toLocaleDateString()})`,
      );
    });
  } else {
    lines.push(
      "No background findings on the ledger yet. Do NOT claim you did work between sessions; offer to check live now instead.",
    );
  }

  lines.push("");
  lines.push("## Momentum & Resilience");
  lines.push(
    "Use this to calibrate your tone and pacing — never to shame or pressure. Score the process, protect rest.",
  );
  lines.push(`Momentum: ${ctx.momentum.score}/100 (${ctx.momentum.band}) — ${ctx.momentum.bandMessage}`);
  if (ctx.momentum.isResting) {
    lines.push("The user is in a protected rest period. Do not push for output; affirm the recovery.");
  }
  lines.push(
    ctx.momentum.cadenceTarget
      ? `Commitment cadence: ${ctx.momentum.qualityApplicationsThisPeriod}/${ctx.momentum.cadenceTarget} quality applications this ${ctx.momentum.cadencePeriod}. ${ctx.momentum.cadenceMessage}`
      : `Quality applications this ${ctx.momentum.cadencePeriod}: ${ctx.momentum.qualityApplicationsThisPeriod}. No cadence target set yet.`,
  );

  return lines.join("\n");
}
