import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
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
      <main className="mx-auto max-w-shell space-y-6">
        <LearningNavigation />
        <h1 className="font-heading text-xl font-semibold">Projects</h1>
        <ProjectRuns mode="all" />
      </main>
    </AppShell>
  );
}
