import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import {
  createApplicationsRepository,
  createDocumentsRepository,
  createJobsRepository,
  createProfilesRepository,
  createSavedJobsRepository,
} from "@careeros/database";

import { AppShell } from "@/components/layout/app-shell";
import { ApplicationWorkspace } from "@/components/workspace/application-workspace";
import { ExternalLink } from "lucide-react";

import { ApplicationOutcomePanel } from "@/components/workspace/application-outcome-panel";
import { FitGatePanel } from "@/components/workspace/fit-gate-panel";
import { AutoPrepRunner } from "@/components/workspace/auto-prep-runner";
import { JobLivenessBanner } from "@/components/workspace/job-liveness-banner";
import { WorkspaceDocActions } from "@/components/workspace/workspace-doc-actions";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { getOnboardingStatus } from "@/lib/onboarding/status";
import { REJECTION_AUTOPSY_PROMPTS } from "@/lib/resilience/framing";

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

  const [job, savedJob, applications, jobDocs, profile] = await Promise.all([
    createJobsRepository(db).findById(jobId),
    createSavedJobsRepository(db).listForUserByJobIds(user.id, [jobId]),
    createApplicationsRepository(db).listForUserByJobIds(user.id, [jobId]),
    createDocumentsRepository(db).listForJob(user.id, jobId),
    createProfilesRepository(db).getByUserId(user.id),
  ]);

  if (!job) notFound();

  const application = applications[0]
    ? {
        id: applications[0].id,
        hasApplied: Boolean(applications[0].appliedAt),
        outcome: applications[0].outcome ?? null,
      }
    : null;

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
          {job.url ? (
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              title="Open the original posting on the source site to apply directly"
            >
              View the original posting <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </div>

        {/* Freshness guard — warn (don't block) if the posting looks closed */}
        <div className="shrink-0">
          <JobLivenessBanner jobId={job.id} jobUrl={job.url} />
        </div>

        {/* Auto-prep — if the user opted in, Fadi drafts the packet on open */}
        {profile?.autoPrepEnabled ? (
          <div className="shrink-0">
            <AutoPrepRunner jobId={job.id} enabled hasDocs={jobDocs.length > 0} />
          </div>
        ) : null}

        {/* Fit gate — should you even apply? (anti-spray, before you invest time) */}
        <div className="shrink-0">
          <FitGatePanel
            jobTitle={job.title}
            jobCompany={job.company}
            jobDescription={job.description ?? undefined}
          />
        </div>

        {/* Outcome + rejection-autopsy */}
        <div className="shrink-0">
          <ApplicationOutcomePanel
            jobId={job.id}
            jobCompany={job.company}
            jobTitle={job.title}
            application={application}
            autopsyPrompts={[...REJECTION_AUTOPSY_PROMPTS]}
          />
        </div>

        {/* Real, saved, JD-tailored documents for this job */}
        <div className="shrink-0">
          <WorkspaceDocActions
            jobId={job.id}
            documents={jobDocs.map((d) => ({ id: d.id, kind: d.kind, title: d.title }))}
          />
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
