import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { StoryBank } from "@/components/interview/story-bank";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { listStories } from "@/lib/interview/story-bank";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const metadata: Metadata = { title: "Interview stories" };
export const dynamic = "force-dynamic";

export default async function InterviewStoriesPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in?next=/dashboard/evidence/stories");

  const [status, stories] = await Promise.all([getOnboardingStatus(user.id), listStories(user.id)]);
  if (status !== "completed") redirect("/onboarding");

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl">
        <StoryBank stories={stories} />
      </div>
    </AppShell>
  );
}
