import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { LearningNavigation } from "@/components/learning/learning-navigation";
import { StartSimulation } from "@/components/learning/start-simulation";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getOnboardingStatus } from "@/lib/onboarding/status";
import { activityRuntime } from "@/lib/practice/packs";

export const metadata: Metadata = { title: "Work simulation" };
export const dynamic = "force-dynamic";

/**
 * ONE WORK SIMULATION, before it starts: what it is, what you'll produce, how it's reviewed, and
 * one action. Not a catalogue — there is no browsing page yet (Codex, Gate 3); this is the door a
 * link, Fadi or a future catalogue opens.
 */
export default async function PracticeActivityPage({
  params,
}: {
  params: Promise<{ packId: string; activityId: string }>;
}) {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in");
  if ((await getOnboardingStatus(user.id)) !== "completed") redirect("/onboarding");
  const { packId, activityId } = await params;
  const runtime = activityRuntime(decodeURIComponent(packId), decodeURIComponent(activityId));
  if (!runtime) notFound();
  const { pack, activity } = runtime;
  const modelReviewed = Object.values(runtime.assets).some((step) =>
    step.criteria.some((c) => c.kind === "quality")
  );
  const { graderStatus } = await import("@/lib/practice/grader-check");
  const grader = modelReviewed ? await graderStatus(user.id) : null;

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl space-y-6">
        <LearningNavigation />
        <section className="space-y-4">
          <p className="text-xs font-medium text-primary">
            Work simulation · {pack.domain.label}
            {pack.trust === "experimental" ? (
              <span className="text-muted-foreground">
                {" "}
                · experimental — not yet reviewed by a practitioner
              </span>
            ) : null}
          </p>
          <h1 className="font-heading text-2xl font-semibold">{activity.title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{activity.outcome}</p>
          <ol className="space-y-1 text-sm">
            {activity.steps.map((step, index) => (
              <li key={step.id}>
                <span className="text-muted-foreground">{index + 1}.</span> {step.title}
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">
            You write each part yourself. Fadi reviews it against named criteria, shows which your
            work meets and why, and you revise until it does. Your case has its own figures, so
            nobody else&apos;s answer fits it.
          </p>
          <StartSimulation packId={pack.id} activityId={activity.id} grader={grader} />
        </section>
      </main>
    </AppShell>
  );
}
