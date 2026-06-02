import type { Metadata } from "next";

import { SiteHeader } from "@/components/layout/site-header";
import { OnboardingShell } from "@/components/shells/onboarding-shell";

export const metadata: Metadata = {
  title: "Onboarding",
};

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="px-4 py-10 sm:px-6">
        <OnboardingShell />
      </main>
    </div>
  );
}
