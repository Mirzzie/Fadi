import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { DashboardHomeSwitch } from "@/components/os/dashboard-home-switch";
import { DashboardShell } from "@/components/shells/dashboard-shell";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDashboardProfileSummary, getLatestCareerReport } from "@/lib/career-report/data";
import { getRecommendedJobsForUser } from "@/lib/jobs/data";
import { getSetupState } from "@/lib/guidance/setup";
import { getOnboardingStatus } from "@/lib/onboarding/status";
import { getMomentumSummary } from "@/lib/resilience/service";
import { getMarketIntelligence } from "@/lib/data-sources/service";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentAuthUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const onboardingStatus = await getOnboardingStatus(user.id);

  if (onboardingStatus !== "completed") {
    redirect("/onboarding");
  }

  const [profileSummary, latestReport, recommendedJobsPreview, momentum, setup] = await Promise.all([
    getDashboardProfileSummary(user.id),
    getLatestCareerReport(user.id),
    getRecommendedJobsForUser(user.id, 3),
    getMomentumSummary(user.id),
    getSetupState(user.id),
  ]);

  // Live market signals scored against this user's role + report findings —
  // the real-world relevance check for their career report (cached, 15m).
  const marketSignals = profileSummary?.targetRole
    ? (
        await getMarketIntelligence(
          {
            targetRole: profileSummary.targetRole,
            skills: (latestReport?.strengths ?? []).map((s) => s.title),
            skillGaps: (latestReport?.missing_skills ?? []).map((s) => s.title),
            region: profileSummary.locationPreference,
          },
          // Permissive "market pulse": always surface live activity, ranked —
          // so the data pipeline is visible even before a report exists.
          { threshold: 0, limit: 6 },
        )
      ).signals.map((s) => ({
        kind: s.kind,
        title: s.title,
        url: s.url ?? null,
        relevance: s.relevance,
        reason: s.reasons[0] ?? "recent activity in your space",
      }))
    : [];

  const firstName = profileSummary?.fullName?.trim().split(/\s+/)[0] || "there";
  const jobsCount = recommendedJobsPreview.length;
  const subline =
    jobsCount > 0
      ? `I've lined up ${jobsCount} role${jobsCount === 1 ? "" : "s"} matched to you, plus your latest market signals. Ask me anything — or tell me what you're working on.`
      : `I'm watching your target market. Ask me about your roadmap, a specific role, or your next move.`;

  // Real opportunities Kai surfaces in Kai mode — the guided next step (if setup
  // isn't complete) leads, then top matched roles + a live signal.
  const opportunities = [
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

  return (
    <AppShell>
      <DashboardHomeSwitch
        greeting={`Hey ${firstName}.`}
        subline={subline}
        opportunities={opportunities}
        desk={
          <DashboardShell
            userEmail={user.email}
            profileSummary={profileSummary}
            latestReport={latestReport}
            recommendedJobsPreview={recommendedJobsPreview}
            momentum={momentum}
            marketSignals={marketSignals}
            setup={setup}
          />
        }
      />
    </AppShell>
  );
}
