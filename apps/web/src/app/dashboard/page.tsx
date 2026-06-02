import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { DashboardShell } from "@/components/shells/dashboard-shell";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDashboardProfileSummary, getLatestCareerReport } from "@/lib/career-report/data";
import { getOnboardingStatus } from "@/lib/onboarding/status";

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

  const [profileSummary, latestReport] = await Promise.all([
    getDashboardProfileSummary(user.id),
    getLatestCareerReport(user.id),
  ]);

  return (
    <AppShell>
      <DashboardShell
        userEmail={user.email}
        profileSummary={profileSummary}
        latestReport={latestReport}
      />
    </AppShell>
  );
}
