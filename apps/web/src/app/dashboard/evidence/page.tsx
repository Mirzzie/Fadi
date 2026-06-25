import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { EvidencePool } from "@/components/evidence/evidence-pool";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { rankedEvidenceForActiveTrack } from "@/lib/evidence/pool";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const metadata: Metadata = { title: "Your evidence" };
export const dynamic = "force-dynamic";

export default async function EvidencePage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in?next=/dashboard/evidence");

  const onboardingStatus = await getOnboardingStatus(user.id);
  if (onboardingStatus !== "completed") redirect("/onboarding");

  const { track, ranked } = await rankedEvidenceForActiveTrack(user.id);

  return (
    <AppShell>
      <EvidencePool track={track} ranked={ranked} />
    </AppShell>
  );
}
