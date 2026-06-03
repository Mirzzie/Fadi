import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { DashboardShell } from "@/components/shells/dashboard-shell";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDashboardProfileSummary, getLatestCareerReport } from "@/lib/career-report/data";
import { getRecommendedJobsForUser } from "@/lib/jobs/data";
import { getOnboardingStatus } from "@/lib/onboarding/status";
import { getMomentumSummary } from "@/lib/resilience/service";

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

  return (
    <AppShell>
      <DashboardShell
        userEmail={user.email}
        profileSummary={profileSummary}
        latestReport={latestReport}
        recommendedJobsPreview={recommendedJobsPreview}
        momentum={momentum}
      />
    </AppShell>
  );
}
