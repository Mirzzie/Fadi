import type { Metadata } from "next";
import { History } from "lucide-react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { ActivityTimeline } from "@/components/learning/activity-timeline";
import { LearningNavigation } from "@/components/learning/learning-navigation";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const metadata: Metadata = { title: "Learning activity" };
export const dynamic = "force-dynamic";

/**
 * The route Codex's architecture called for and nothing had built — a 404 where "what
 * happened and why" was supposed to live.
 */
export default async function LearningActivityPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in");
  if ((await getOnboardingStatus(user.id)) !== "completed") redirect("/onboarding");

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6">
        <LearningNavigation />

        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <History className="size-5" aria-hidden="true" />
            Activity
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything Fadi has done on this machine and the devices you have connected, grouped by
            what it was trying to do. Refusals are never folded away.
          </p>
        </div>

        <ActivityTimeline />
      </main>
    </AppShell>
  );
}
