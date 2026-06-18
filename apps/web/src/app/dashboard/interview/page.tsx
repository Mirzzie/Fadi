import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { StoryBank } from "@/components/interview/story-bank";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { listStories } from "@/lib/interview/story-bank";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const metadata: Metadata = { title: "Interview prep" };
export const dynamic = "force-dynamic";

export default async function InterviewPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in?next=/dashboard/interview");

  const onboardingStatus = await getOnboardingStatus(user.id);
  if (onboardingStatus !== "completed") redirect("/onboarding");

  const stories = await listStories(user.id);

  return (
    <AppShell>
      <StoryBank stories={stories} />
    </AppShell>
  );
}
