import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { EvidencePool } from "@/components/evidence/evidence-pool";
import {
  createCareerProfilesRepository,
  createLinkedInProfilesRepository,
  createResumesRepository,
} from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
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

  // Is there history on file that nothing has been built from? The screen answers a different
  // question in that state, so it asks the database rather than showing a generic empty box.
  const db = getDatabase();
  const activeTrack = await createCareerProfilesRepository(db).getActiveForUser(user.id);
  const [resume, linkedIn] = await Promise.all([
    createResumesRepository(db).getLatestForTrack(user.id, activeTrack?.id ?? null),
    createLinkedInProfilesRepository(db).getLatestForUser(user.id),
  ]);
  const hasStoredHistory = Boolean(
    (resume?.parsedText ?? resume?.rawText ?? "").trim() || (linkedIn?.rawText ?? "").trim()
  );

  return (
    <AppShell>
      <EvidencePool track={track} ranked={ranked} hasStoredHistory={hasStoredHistory} />
    </AppShell>
  );
}
