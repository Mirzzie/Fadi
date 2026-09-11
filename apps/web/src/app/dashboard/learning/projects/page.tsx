import type { Metadata } from "next";
import { Boxes } from "lucide-react";
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
        <header className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Boxes className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-semibold">Projects</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Build the next useful thing, one step at a time. Completion and evidence stay separate
              so the record never claims more than you can show.
            </p>
          </div>
        </header>
        <ProjectRuns mode="all" />
      </main>
    </AppShell>
  );
}
