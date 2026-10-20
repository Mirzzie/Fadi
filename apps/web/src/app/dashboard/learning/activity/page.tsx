import type { Metadata } from "next";
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
      <main className="mx-auto w-full max-w-4xl space-y-5 pb-12">
        <LearningNavigation />

        <div className="border-b border-border pb-7 pt-3">
          <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Practice history
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Activity</h1>
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
