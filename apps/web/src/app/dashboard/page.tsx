import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { AppShell } from "@/components/layout/app-shell";
import { DashboardShell } from "@/components/shells/dashboard-shell";
import { FadiImpactCard } from "@/components/dashboard/fadi-impact-card";
import { getFadiImpact } from "@/lib/impact/fadi-impact";
import { maybeRunAgentForUser } from "@/lib/agents/background";
import { composeBriefing } from "@/lib/agents/briefing";
import { deliverDigestToChat, digestSubline, getAgencyDigest } from "@/lib/agents/digest";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDashboardProfileSummary, getLatestCareerReport } from "@/lib/career-report/data";
import { getRecommendedJobsForUser } from "@/lib/jobs/data";
import { getSetupState } from "@/lib/guidance/setup";
import { onboardingStatusOf } from "@/lib/onboarding/status";
import { getMomentumReflection, getMomentumSummary } from "@/lib/resilience/service";
import { getMarketIntelligence } from "@/lib/data-sources/service";
import {
  createCareerProfilesRepository,
  createEvidenceRepository,
  createLearningCommitmentsRepository,
  createLinkedInProfilesRepository,
  createResumesRepository,
} from "@careeros/database";
import { cookies } from "next/headers";
import { getDatabase } from "@/lib/database/client";
import { reportStaleness } from "@/lib/career-report/staleness";
import { PrepareFocus } from "@/components/dashboard/prepare-focus";
import { MODE_COOKIE, type CareerMode } from "@/app/dashboard/mode";
import type { ScoredSignal } from "@/lib/data-sources/relevance";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentAuthUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const db = getDatabase();
  const [
    profileSummary,
    latestReport,
    recommendedJobsPreview,
    momentum,
    reflection,
    setup,
    digest,
    impact,
    latestEvidenceAt,
    activeTrack,
    linkedin,
  ] = await Promise.all([
    getDashboardProfileSummary(user.id),
    getLatestCareerReport(user.id),
    getRecommendedJobsForUser(user.id, 3, undefined, { skipSync: true }),
    getMomentumSummary(user.id),
    getMomentumReflection(user.id),
    getSetupState(user.id),
    getAgencyDigest(user.id),
    getFadiImpact(user.id),
    createEvidenceRepository(db).latestUpdatedAt(user.id),
    createCareerProfilesRepository(db).getActiveForUser(user.id),
    createLinkedInProfilesRepository(db).getLatestForUser(user.id),
  ]);
  // Same source as the shell (the cookie) so the nav and the content never disagree.
  const careerMode: CareerMode =
    (await cookies()).get(MODE_COOKIE)?.value === "prepare" ? "prepare" : "apply";

  // The résumé is per-track (each direction tailors its own), so compare the report
  // against THIS track's résumé — not a change on some other direction.
  const trackResume = activeTrack
    ? await createResumesRepository(db).getLatestForTrack(user.id, activeTrack.id)
    : null;

  // Living projection: does the report still reflect the sources it was built from —
  // the evidence pool, this track's résumé, and the LinkedIn record?
  const reportStale = reportStaleness({
    reportGeneratedAt: latestReport?.generated_at ?? latestReport?.created_at ?? null,
    latestEvidenceAt,
    latestResumeAt: trackResume?.updatedAt ?? null,
    latestLinkedInAt: linkedin?.updatedAt ?? null,
  });

  // Open builds in the ACTIVE direction's Prepare plan — the weekly pull-back hook.
  // These are commitments (often autopsy-prescribed) not yet completed into evidence.
  const openBuilds = (await createLearningCommitmentsRepository(db).listForUser(user.id)).filter(
    (c) => c.status === "committed" && c.careerProfileId === (activeTrack?.id ?? null),
  ).length;

  // Gate on the summary we already loaded — no separate profiles round-trip.
  if (onboardingStatusOf(profileSummary) !== "completed") {
    redirect("/onboarding");
  }

  // Deliver the background-agency digest into Fadi's chat (once per finding),
  // and kick off the next agency pass after the response is sent — this keeps
  // the agency real even on deployments with no cron scheduler.
  if (digest) {
    await deliverDigestToChat(user.id, digest);
  }
  after(() => maybeRunAgentForUser(user.id));

  // Live market signals scored against this user's role + report findings —
  // the real-world relevance check for their career report (cached, 15m).
  // Never block the home page on a slow signal API. Wait at most ~2.5s; the
  // underlying fetch still completes and warms the 15m cache for the next load.
  const EMPTY_SIGNALS: ScoredSignal[] = [];
  const signalIntel = profileSummary?.targetRole
    ? await Promise.race([
        getMarketIntelligence(
          {
            targetRole: profileSummary.targetRole,
            skills: (latestReport?.strengths ?? []).map((s) => s.title),
            skillGaps: (latestReport?.missing_skills ?? []).map((s) => s.title),
            region: profileSummary.locationPreference,
          },
          // Permissive "market pulse": always surface live activity, ranked —
          // so the data pipeline is visible even before a report exists.
          { threshold: 0, limit: 6 }
        ).then((r) => r.signals),
        new Promise<typeof EMPTY_SIGNALS>((resolve) =>
          setTimeout(() => resolve(EMPTY_SIGNALS), 2500)
        ),
      ])
    : EMPTY_SIGNALS;
  const marketSignals = signalIntel.map((s) => ({
    kind: s.kind,
    title: s.title,
    url: s.url ?? null,
    relevance: s.relevance,
    reason: s.reasons[0] ?? "recent activity in your space",
  }));

  const firstName = profileSummary?.fullName?.trim().split(/\s+/)[0] || "there";
  const jobsCount = recommendedJobsPreview.length;
  // The digest leads when the background agency found something — that's the
  // real "Fadi has been working" moment, grounded in the findings ledger.
  const subline = digest
    ? digestSubline(digest)
    : jobsCount > 0
      ? `I've lined up ${jobsCount} role${jobsCount === 1 ? "" : "s"} matched to you, plus your latest market signals. Ask me anything — or tell me what you're working on.`
      : `I'm watching your target market. Ask me about your roadmap, a specific role, or your next move.`;

  // Real opportunities Fadi surfaces in Fadi mode — fresh agency findings lead,
  // then the guided next step, then top matched roles + a live signal.
  const opportunities = [
    ...(digest?.findings ?? []).slice(0, 2).map((finding) => ({
      label: finding.kind === "expired_saved_role" ? "Heads up" : "While you were away",
      detail: finding.title,
      href: finding.href ?? "/dashboard",
    })),
    ...(setup.nextStep
      ? [{ label: "Next step", detail: setup.nextStep.title, href: setup.nextStep.href }]
      : []),
    ...recommendedJobsPreview.slice(0, 2).map((job) => ({
      label: "New role",
      detail: `${job.title} · ${job.company}`,
      href: "/dashboard/jobs",
    })),
    ...marketSignals.slice(0, 1).map((signal) => ({
      label: "Market signal",
      detail: signal.title,
      href: "/dashboard",
    })),
  ].slice(0, 3);

  // Fadi's proactive briefing — composed from the data already fetched above, so
  // every spoken line traces to something real (honest, never fabricated).
  const briefing = composeBriefing({
    firstName,
    findings: digest?.findings,
    topJob: recommendedJobsPreview[0]
      ? { title: recommendedJobsPreview[0].title, company: recommendedJobsPreview[0].company }
      : null,
    signal: marketSignals[0] ? { title: marketSignals[0].title, url: marketSignals[0].url } : null,
    momentum: {
      cadenceTarget: momentum.cadenceTarget,
      cadencePeriod: momentum.cadencePeriod,
      qualityApplicationsThisPeriod: momentum.qualityApplicationsThisPeriod,
      isResting: momentum.isResting,
    },
    learning: latestReport?.recommended_learning_path?.[0]
      ? { title: latestReport.recommended_learning_path[0].title }
      : null,
  });

  return (
    <AppShell>
      {careerMode === "prepare" && (
        <div className="mx-auto mb-4 max-w-shell">
          <PrepareFocus
            targetRole={profileSummary?.targetRole ?? null}
            missingSkills={latestReport?.missing_skills ?? []}
            learningPath={latestReport?.recommended_learning_path ?? []}
            hasReport={Boolean(latestReport)}
          />
        </div>
      )}
      <DashboardShell
        userEmail={user.email}
        briefing={briefing}
        greeting={`Hey ${firstName}.`}
        subline={subline}
        opportunities={opportunities}
        profileSummary={profileSummary}
        latestReport={latestReport}
        reportStale={reportStale}
        recommendedJobsPreview={recommendedJobsPreview}
        momentum={momentum}
        reflection={reflection}
        marketSignals={marketSignals}
        setup={setup}
        openBuilds={openBuilds}
      />
      <div className="mx-auto mt-4 max-w-shell">
        <FadiImpactCard impact={impact} />
      </div>
    </AppShell>
  );
}
