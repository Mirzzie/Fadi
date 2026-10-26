import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PageIntro } from "@/components/layout/page-intro";
import { LearningNavigation } from "@/components/learning/learning-navigation";
import { ProjectRuns } from "@/components/learning/project-run";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const metadata: Metadata = { title: "Learning projects" };
export const dynamic = "force-dynamic";

export default async function LearningProjectsPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in");
  if ((await getOnboardingStatus(user.id)) !== "completed") redirect("/onboarding");

  return (
    <AppShell>
      <div className="mx-auto max-w-shell space-y-6">
        <LearningNavigation />
        <PageIntro
          eyebrow="Practice"
          title="Projects"
          description="Continue your work and review the steps ahead."
        />
        <ProjectRuns mode="all" />
      </div>
    </AppShell>
  );
}
