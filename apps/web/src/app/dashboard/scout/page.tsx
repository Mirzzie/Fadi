import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { ScoutChat } from "@/components/scout/scout-chat";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const metadata: Metadata = { title: "Scout" };
export const dynamic = "force-dynamic";

export default async function ScoutPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in");

  const onboardingStatus = await getOnboardingStatus(user.id);
  if (onboardingStatus !== "completed") redirect("/onboarding");

  return (
    <AppShell>
      <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-3xl flex-col gap-4">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="glow-primary relative grid size-10 place-items-center rounded-full bg-gradient-to-br from-primary/25 to-[oklch(0.66_0.22_285)]/20 ring-2 ring-primary/15">
              <Sparkles className="size-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold tracking-tight">Scout</h1>
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                  Active
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Your career operating intelligence — ask anything.
              </p>
            </div>
          </div>
          <span className="hidden rounded-full border border-amber-500/25 bg-amber-500/5 px-3 py-1 text-xs text-amber-300/90 sm:inline">
            Real-time voice — Phase 2
          </span>
        </div>

        {/* Chat */}
        <div className="scout-glow-sm min-h-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-card">
          <ScoutChat />
        </div>

        <p className="shrink-0 text-center text-xs text-muted-foreground">
          Set your AI provider in{" "}
          <a href="/dashboard/settings" className="text-primary hover:underline">
            Settings
          </a>{" "}
          to wake Scout. Scout never acts externally without your approval.
        </p>
      </div>
    </AppShell>
  );
}
