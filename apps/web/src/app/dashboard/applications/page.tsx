import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { ApplicationsBoard } from "@/components/applications/applications-board";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import {
  createApplicationsRepository,
  createDocumentsRepository,
} from "@careeros/database";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const metadata: Metadata = { title: "Applications" };
export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in?next=/dashboard/applications");

  const onboardingStatus = await getOnboardingStatus(user.id);
  if (onboardingStatus !== "completed") redirect("/onboarding");

  const db = getDatabase();
  const [apps, docs] = await Promise.all([
    createApplicationsRepository(db).listForUser(user.id),
    createDocumentsRepository(db).listForUser(user.id),
  ]);

  return (
    <AppShell>
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
