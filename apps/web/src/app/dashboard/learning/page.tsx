import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookOpen, GraduationCap, Sparkles } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { KaiBadge } from "@/components/ui/kai-badge";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const metadata: Metadata = {
  title: "Learning",
};

export const dynamic = "force-dynamic";

export default async function LearningPage() {
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
      <div className="mx-auto max-w-shell space-y-6">
        <section className="rounded-xl border border-border/60 bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10">
              <GraduationCap className="size-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Learning Hub</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Skill gap analysis and your personalized learning path.
              </p>
            </div>
          </div>
        </section>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
          <div className="flex items-start gap-4">
            <KaiBadge size="sm" showName={false} />
            <div className="space-y-2">
              <p className="text-sm font-medium text-primary">Kai</p>
              <p className="text-sm leading-relaxed text-card-foreground">
                Generate your Career Intelligence Report from the dashboard first, and I&apos;ll
                build a prioritized learning plan from your skill gaps — tied directly to your
                target role.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: "Skill gap analysis",
              body: "Kai identifies the specific skills holding you back from your target role.",
            },
            {
              icon: BookOpen,
              title: "Curated resources",
              body: "Courses, certifications, and projects ranked by impact on your career readiness.",
            },
            {
              icon: GraduationCap,
              title: "Progress tracking",
              body: "Mark resources complete and watch your career readiness score improve.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-border/60 bg-card p-5 opacity-60"
            >
              <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-muted">
                <card.icon className="size-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <h3 className="mb-1.5 font-medium">{card.title}</h3>
              <p className="text-sm text-muted-foreground">{card.body}</p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-amber-400" aria-hidden="true" />
                Coming in Phase 6
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
