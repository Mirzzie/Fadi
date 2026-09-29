import type { Metadata } from "next";
import { Laptop } from "lucide-react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { ComputerLabs } from "@/components/learning/computer-labs";
import { LabDisks } from "@/components/learning/lab-disks";
import { LearningNavigation } from "@/components/learning/learning-navigation";
import { MachineRegistration } from "@/components/learning/lab-fit";
import { MachineAccess } from "@/components/learning/machine-access";
import { MachineInventory } from "@/components/learning/machine-inventory";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const metadata: Metadata = { title: "Learning machines" };
export const dynamic = "force-dynamic";

/**
 * Where labs run, and what Fadi may touch. Reported as "a lot of things to see, but nothing
 * to see": a header essay, a caption under every section, a five-stage explainer and three
 * summary cards around two real controls. What stays is what you can see or do.
 */
export default async function LearningMachinesPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in");
  if ((await getOnboardingStatus(user.id)) !== "completed") redirect("/onboarding");

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-2 pb-28 sm:px-4">
        <LearningNavigation />

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-heading text-xl font-semibold">Machines</h1>
            <MachineRegistration />
          </div>
          {/* The laptop is where labs run by default. It was never listed, so projects said
              "No machine selected" while a lab was running on it. */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 px-4 py-3">
              <Laptop className="size-5 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">This computer</p>
                <p className="text-xs text-muted-foreground">
                  Labs run here in Docker, after you approve them.
                </p>
              </div>
            </div>
            <ComputerLabs />
            <LabDisks />
          </div>
          <MachineInventory />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Access</h2>
          <MachineAccess />
        </section>
      </main>
    </AppShell>
  );
}
