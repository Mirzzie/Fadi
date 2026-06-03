import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createJobsRepository, createSavedJobsRepository } from "@careeros/database";

import { AppShell } from "@/components/layout/app-shell";
import { ApplicationWorkspace } from "@/components/workspace/application-workspace";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ jobId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { jobId } = await params;
  const db = getDatabase();
  const job = await createJobsRepository(db).findById(jobId);
  if (!job) return { title: "Application Workspace" };
  return { title: `${job.title} at ${job.company} — Workspace` };
}

export default async function ApplicationWorkspacePage({ params }: Props) {
  const { jobId } = await params;

  const user = await getCurrentAuthUser();

  if (!user) redirect("/auth/sign-in");

  const onboardingStatus = await getOnboardingStatus(user.id);

  if (onboardingStatus !== "completed") redirect("/onboarding");

  const db = getDatabase();

  const [job, savedJob] = await Promise.all([
    createJobsRepository(db).findById(jobId),
    createSavedJobsRepository(db).listForUserByJobIds(user.id, [jobId]),
  ]);

  if (!job) notFound();

  return (
    <AppShell>
      <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-6xl flex-col gap-4 pb-4">
        {/* Workspace header */}
        <div className="shrink-0">
          <h1 className="text-lg font-semibold">
            {job.title}{" "}
            <span className="text-muted-foreground font-normal">at {job.company}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Application workspace — all documents are drafts until you approve them
          </p>
        </div>

        {/* Workspace */}
        <div className="min-h-0 flex-1">
          <ApplicationWorkspace
            jobId={job.id}
            jobTitle={job.title}
            jobCompany={job.company}
            jobDescription={job.description ?? undefined}
            matchScore={savedJob[0]?.matchScore ?? null}
          />
        </div>
      </div>
    </AppShell>
  );
}
