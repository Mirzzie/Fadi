import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { JobsShell } from "@/components/jobs/jobs-shell";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getRecommendedJobsForUser } from "@/lib/jobs/data";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const metadata: Metadata = {
  title: "Jobs",
};

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const user = await getCurrentAuthUser();

  if (!user) {
    redirect("/auth/sign-in?next=/dashboard/jobs");
  }

  const onboardingStatus = await getOnboardingStatus(user.id);

  if (onboardingStatus !== "completed") {
    redirect("/onboarding");
  }

  const jobs = await getRecommendedJobsForUser(user.id);

  return (
    <AppShell>
      <JobsShell jobs={jobs} />
    </AppShell>
  );
}
