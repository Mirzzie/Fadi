import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { DashboardShell } from "@/components/shells/dashboard-shell";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDashboardProfileSummary, getLatestCareerReport } from "@/lib/career-report/data";
import { getRecommendedJobsForUser } from "@/lib/jobs/data";
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

  const [profileSummary, latestReport, recommendedJobsPreview, momentum] = await Promise.all([
    getDashboardProfileSummary(user.id),
    getLatestCareerReport(user.id),
    getRecommendedJobsForUser(user.id, 3),
    getMomentumSummary(user.id),
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

  return (
    <AppShell>
      <DashboardShell
        userEmail={user.email}
        profileSummary={profileSummary}
        latestReport={latestReport}
        recommendedJobsPreview={recommendedJobsPreview}
        momentum={momentum}
        marketSignals={marketSignals}
      />
    </AppShell>
  );
}
