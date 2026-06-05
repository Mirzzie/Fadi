import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { NicheFinder } from "@/components/niche/niche-finder";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const metadata: Metadata = {
  title: "Niche Finder",
};

export const dynamic = "force-dynamic";

export default async function NicheFinderPage() {
  const user = await getCurrentAuthUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const onboardingStatus = await getOnboardingStatus(user.id);

  if (onboardingStatus !== "completed") {
    redirect("/onboarding");
  }

  return (
    <AppShell>
      <NicheFinder />
    </AppShell>
  );
}
