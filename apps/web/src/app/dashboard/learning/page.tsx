import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createCareerProfilesRepository, createLearningCommitmentsRepository } from "@careeros/database";

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

  const db = getDatabase();
  const [report, commitments, track] = await Promise.all([
    getLatestCareerReport(user.id),
    createLearningCommitmentsRepository(db).listForUser(user.id),
    createCareerProfilesRepository(db).getActiveForUser(user.id),
  ]);

  return (
    <AppShell>
      <LearningShell
        report={report}
        // Only THIS direction's commitments — a commitment is per-track, so another
        // direction's builds (e.g. a cyber SIEM project) must not show under DevOps.
        commitments={commitments
          .filter((c) => c.careerProfileId === (track?.id ?? null))
          .map(toCommitmentView)}
        role={track?.targetRole ?? null}
      />
    </AppShell>
  );
}
