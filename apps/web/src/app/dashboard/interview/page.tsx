import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { MockInterview } from "@/components/interview/mock-interview";
import { StoryBank } from "@/components/interview/story-bank";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDashboardProfileSummary } from "@/lib/career-report/data";
import { listStories } from "@/lib/interview/story-bank";
import { onboardingStatusOf } from "@/lib/onboarding/status";

export const metadata: Metadata = { title: "Interview prep" };
export const dynamic = "force-dynamic";

export default async function InterviewPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in?next=/dashboard/interview");

  const [stories, profile] = await Promise.all([
    listStories(user.id),
    getDashboardProfileSummary(user.id),
  ]);

  // Gate on the summary we already loaded — no separate profiles round-trip.
  if (onboardingStatusOf(profile) !== "completed") redirect("/onboarding");

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
        <MockInterview
          defaults={{
            role: profile?.targetRole ?? "",
            country: profile?.locationPreference ?? "",
            seniority: profile?.experienceLevel ?? "",
          }}
        />
      </div>
      <StoryBank stories={stories} />
    </AppShell>
  );
}
