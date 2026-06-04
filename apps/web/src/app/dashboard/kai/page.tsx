import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Mic, Radio, Sparkles, Zap } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { KaiBadge } from "@/components/ui/kai-badge";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const metadata: Metadata = {
  title: "Kai",
};

export const dynamic = "force-dynamic";

const activeAgents = [
  { name: "Job Discovery", status: "Monitoring 3 sources", icon: Sparkles },
  { name: "Market Intelligence", status: "Tracking your target sector", icon: Radio },
  { name: "Career Analysis", status: "Idle — generate a report to activate", icon: Zap },
];

export default async function KaiPage() {
  const user = await getCurrentAuthUser();

  if (!user) redirect("/auth/sign-in");

  const onboardingStatus = await getOnboardingStatus(user.id);

  if (onboardingStatus !== "completed") redirect("/onboarding");

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-8 pt-4">
        {/* Kai presence */}
        <div className="flex flex-col items-center gap-5 py-8 text-center">
          <div className="relative">
            <div className="glow-primary flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 to-[oklch(0.66_0.22_285)]/20 ring-4 ring-primary/10">
              <Sparkles className="size-9 text-primary" aria-hidden="true" />
            </div>
            {/* Pulse rings */}
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/10" aria-hidden="true" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-semibold">Kai</h1>
              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                Active
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your career operating intelligence — always on, working for you.
            </p>
          </div>
        </div>

        {/* Voice interface — real-time streaming coming in Phase 2 */}
        <div className="gradient-border glass-card glow-primary rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <KaiBadge size="sm" />
            <span className="text-xs text-muted-foreground">Voice interface</span>
          </div>

          <div className="flex flex-col items-center gap-4 py-4">
            <button
              className="glow-primary flex size-16 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/30 transition-all hover:bg-primary/20 hover:ring-primary/50 active:scale-95"
              aria-label="Hold to speak to Kai"
            >
              <Mic className="size-7 text-primary" aria-hidden="true" />
            </button>
            <p className="text-sm text-muted-foreground">Hold to speak to Kai</p>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-amber-400">
              <span className="size-1.5 rounded-full bg-amber-400" aria-hidden="true" />
              Real-time voice streaming — Phase 2
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              OpenAI Realtime API integration for JARVIS-quality bidirectional voice is being built
              next. For now, use the application workspaces for Kai-powered document generation.
            </p>
          </div>
        </div>

        {/* Active agents status */}
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Active agents
          </p>
          <div className="space-y-3">
            {activeAgents.map((agent) => (
              <div key={agent.name} className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <agent.icon className="size-3.5 text-primary" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">{agent.status}</p>
                </div>
                <div className="size-2 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>

        {/* What Kai can do */}
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Kai&apos;s capabilities
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              "Monitors job market 24x7",
              "Analyzes your career gaps honestly",
              "Validates career direction vs real data",
              "Calls out hype — no yes-man behaviour",
              "Per-job application workspaces",
              "Generates CVs, cover letters, cold emails",
              "Builds personalized learning paths",
              "Recommends events and networking",
              "Works with any AI provider",
              "Voice-first interaction (Phase 2)",
            ].map((capability) => (
              <div key={capability} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="size-3 shrink-0 text-primary/60" aria-hidden="true" />
                {capability}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
