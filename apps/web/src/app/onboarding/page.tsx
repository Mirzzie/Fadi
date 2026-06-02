import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/layout/site-header";
import { OnboardingShell } from "@/components/shells/onboarding-shell";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const metadata: Metadata = {
  title: "Onboarding",
};

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentAuthUser();

  if (!user) {
    redirect("/auth/sign-in?next=/onboarding");
  }

  const onboardingStatus = await getOnboardingStatus(user.id);

  if (onboardingStatus === "completed") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="px-4 py-10 sm:px-6">
        <OnboardingShell />
      </main>
    </div>
  );
}
