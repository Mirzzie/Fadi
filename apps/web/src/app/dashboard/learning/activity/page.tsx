import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PageIntro } from "@/components/layout/page-intro";
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
      <div className="mx-auto w-full max-w-4xl space-y-5 pb-12">
        <LearningNavigation />

        <PageIntro
          eyebrow="Practice history"
          title="Activity"
          description="Review recorded actions on this computer and your connected devices, grouped by their purpose. Refusals remain visible."
        />

        <ActivityTimeline />
      </div>
    </AppShell>
  );
}
