import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createLearningCommitmentsRepository } from "@careeros/database";

import { AppShell } from "@/components/layout/app-shell";
import { LearningShell } from "@/components/learning/learning-shell";
import { toCommitmentView } from "@/lib/learning/commitments-view";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { getLatestCareerReport } from "@/lib/career-report/data";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const metadata: Metadata = {
  title: "Learning",
};

export const dynamic = "force-dynamic";

export default async function LearningPage() {
  const user = await getCurrentAuthUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const onboardingStatus = await getOnboardingStatus(user.id);

  if (onboardingStatus !== "completed") {
    redirect("/onboarding");
  }

  const [report, commitments] = await Promise.all([
    getLatestCareerReport(user.id),
    createLearningCommitmentsRepository(getDatabase()).listForUser(user.id),
  ]);

  return (
    <AppShell>
      <LearningShell report={report} commitments={commitments.map(toCommitmentView)} />
    </AppShell>
  );
}
