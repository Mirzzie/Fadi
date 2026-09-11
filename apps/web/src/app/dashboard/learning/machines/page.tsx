import type { Metadata } from "next";
import { MonitorCog, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { LearningNavigation } from "@/components/learning/learning-navigation";
import { MachineRegistration } from "@/components/learning/lab-fit";
import { MachineAccess } from "@/components/learning/machine-access";
import { MachineInventory } from "@/components/learning/machine-inventory";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const metadata: Metadata = { title: "Learning machines" };
export const dynamic = "force-dynamic";

export default async function LearningMachinesPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in");
  if ((await getOnboardingStatus(user.id)) !== "completed") redirect("/onboarding");

  return (
    <AppShell>
      <main className="mx-auto max-w-shell space-y-6">
        <LearningNavigation />
        <header className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <MonitorCog className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-semibold">Machines</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              See what Fadi knows about your lab, where projects are placed, and what access is
              currently allowed. Registration, reachability, and readiness are different facts.
            </p>
          </div>
        </header>

        <section className="space-y-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MonitorCog className="size-3.5" aria-hidden="true" /> Registered machines
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Capacity and placement records. These cards do not claim that a machine is online.
            </p>
          </div>
          <MachineInventory />
          <MachineRegistration />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="size-3.5" aria-hidden="true" /> Access and safety
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Permissions, pending decisions, the local workspace, and the machine audit record.
            </p>
          </div>
          <MachineAccess />
        </section>
      </main>
    </AppShell>
  );
}
