import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { LearningNavigation } from "@/components/learning/learning-navigation";
import { ProjectWorkspace } from "@/components/learning/project-workspace";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const metadata: Metadata = { title: "Project workspace" };
export const dynamic = "force-dynamic";

export default async function LearningProjectWorkspacePage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in");
  if ((await getOnboardingStatus(user.id)) !== "completed") redirect("/onboarding");
  const { runId } = await params;

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-[112rem] space-y-6 px-2 sm:px-4">
        <LearningNavigation />
        <ProjectWorkspace runId={runId} />
      </main>
    </AppShell>
  );
}
