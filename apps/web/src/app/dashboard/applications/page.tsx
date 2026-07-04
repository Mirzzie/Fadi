import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { ApplicationsBoard } from "@/components/applications/applications-board";
import { BatchPrep } from "@/components/applications/batch-prep";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import {
  createApplicationsRepository,
  createDocumentsRepository,
  createProfilesRepository,
} from "@careeros/database";
import { onboardingStatusOf } from "@/lib/onboarding/status";

export const metadata: Metadata = { title: "Applications" };
export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in?next=/dashboard/applications");

  const db = getDatabase();
  const [apps, docs, profile] = await Promise.all([
    createApplicationsRepository(db).listForUser(user.id),
    createDocumentsRepository(db).listForUser(user.id),
    createProfilesRepository(db).getByUserId(user.id),
  ]);

  // Gate on the profile we loaded in-batch — parallelized, not a serial round-trip.
  if (onboardingStatusOf(profile) !== "completed") redirect("/onboarding");

  // Batch-prep candidates: active-pipeline roles with a JD but NO documents yet.
  // Rejected/withdrawn are excluded — never spend the user's AI budget on closed doors.
  const docKeys = new Set(docs.flatMap((d) => [d.applicationId, d.jobId].filter(Boolean) as string[]));
  const batchCandidates = apps
    .filter(
      (a) =>
        a.jobId &&
        (a.jobDescription ?? "").trim().length > 0 &&
        (a.status === "interested" || a.status === "applied" || a.status === "interviewing") &&
        !docKeys.has(a.id) &&
        !docKeys.has(a.jobId),
    )
    .map((a) => ({ jobId: a.jobId as string, title: a.title, company: a.company }));

  return (
    <AppShell>
      <div className="mx-auto max-w-shell">
        <BatchPrep candidates={batchCandidates} />
      </div>
      <ApplicationsBoard
        applications={apps.map((a) => ({
          id: a.id,
          jobId: a.jobId,
          company: a.company,
          title: a.title,
          status: a.status,
          url: a.url,
          jobDescription: a.jobDescription,
          appliedAt: a.appliedAt ? a.appliedAt.toISOString() : null,
        }))}
        documents={docs
          .filter((d) => d.applicationId || d.jobId)
          .map((d) => ({
            id: d.id,
            kind: d.kind,
            title: d.title,
            applicationId: d.applicationId,
            jobId: d.jobId,
          }))}
      />
    </AppShell>
  );
}
