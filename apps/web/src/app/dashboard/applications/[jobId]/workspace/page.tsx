import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import {
  createApplicationsRepository,
  createCareerProfilesRepository,
  createDocumentsRepository,
  createEvidenceArtifactsRepository,
  createJobsRepository,
  createProfilesRepository,
} from "@careeros/database";

import { AppShell } from "@/components/layout/app-shell";
import { FadiGuardianVoice } from "@/components/os/fadi-guardian-voice";
import { ApplicationOutcomePanel } from "@/components/workspace/application-outcome-panel";
import { AutoPrepRunner } from "@/components/workspace/auto-prep-runner";
import { CompanyBriefPanel } from "@/components/workspace/company-brief-panel";
import { CvReviewPanel } from "@/components/workspace/cv-review-panel";
import { FadiGuardianCallout } from "@/components/workspace/fadi-guardian-callout";
import { FitGatePanel } from "@/components/workspace/fit-gate-panel";
import { InterviewPrepPanel } from "@/components/workspace/interview-prep-panel";
import { JobContextCard } from "@/components/workspace/job-context-card";
import { JobLivenessBanner } from "@/components/workspace/job-liveness-banner";
import { WorkspaceDocActions } from "@/components/workspace/workspace-doc-actions";
import { resolveApplicationJobContext } from "@/lib/applications/job-context";
import { selectProjectProof } from "@/lib/applications/project-proof";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { buildCareerContext } from "@/lib/career/context";
import { getDatabase } from "@/lib/database/client";
import { evaluateApply } from "@/lib/guardian/guardian";
import { scoreJobForUser } from "@/lib/jobs/job-matching";
import { onboardingStatusOf } from "@/lib/onboarding/status";
import { REJECTION_AUTOPSY_PROMPTS } from "@/lib/resilience/framing";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ jobId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { jobId } = await params;
  const user = await getCurrentAuthUser();
  if (!user) return { title: "Application Workspace" };
  const db = getDatabase();
  const [job, applications] = await Promise.all([
    createJobsRepository(db).findByIdForUser(user.id, jobId),
    createApplicationsRepository(db).listForUserByJobIds(user.id, [jobId]),
  ]);
  if (!job) return { title: "Application Workspace" };
  const application = applications[0];
  return {
    title: `${application?.title.trim() || job.title} at ${application?.company.trim() || job.company} — Workspace`,
  };
}

export default async function ApplicationWorkspacePage({ params }: Props) {
  const { jobId } = await params;
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in");

  const db = getDatabase();
  const [job, applications, jobDocs, profile, track] = await Promise.all([
    createJobsRepository(db).findByIdForUser(user.id, jobId),
    createApplicationsRepository(db).listForUserByJobIds(user.id, [jobId]),
    createDocumentsRepository(db).listForJob(user.id, jobId),
    createProfilesRepository(db).getByUserId(user.id),
    createCareerProfilesRepository(db).getActiveForUser(user.id),
  ]);

  if (onboardingStatusOf(profile) !== "completed") redirect("/onboarding");
  if (!job) notFound();

  // Discovery data can go stale. Once an application exists, the person's saved
  // title, company, URL and description are authoritative for this workspace.
  const savedApplication = applications[0] ?? null;
  const context = resolveApplicationJobContext(job, savedApplication);
  const jobTitle = context.title;
  const jobCompany = context.company;
  const jobDescription = context.description ?? "";
  const jobUrl = context.url;
  const status = savedApplication?.status ?? "interested";
  const hasJobContext = jobDescription.length > 0;
  const beforeApplying = status === "interested";
  const inInterviewJourney = status === "applied" || status === "interviewing";
  const journeyFinished = status === "offer" || status === "rejected" || status === "withdrawn";

  const match = scoreJobForUser({
    careerProfile: track,
    resume: null,
    job: { ...job, title: jobTitle, company: jobCompany, description: jobDescription || null },
  });
  const guardian = evaluateApply({
    onRole: match.onRole,
    fieldRelated: match.fieldRelated,
    overLevel: match.overLevel,
    targetRole: track?.targetRole ?? null,
    jobTitle,
  });

  const application = savedApplication
    ? {
        id: savedApplication.id,
        hasApplied: savedApplication.status !== "interested",
        outcome: savedApplication.outcome ?? null,
      }
    : null;

  const documents = jobDocs.map((document) => ({
    id: document.id,
    kind: document.kind,
    title: document.title,
  }));

  const careerContext = hasJobContext
    ? await buildCareerContext(user.id, {
        directionId: savedApplication?.careerProfileId ?? track?.id,
        applicationId: savedApplication?.id,
        jobId: job.id,
      })
    : null;
  const projectSelection = careerContext
    ? selectProjectProof(careerContext.payload.records, [])
    : null;
  const projectArtifacts = await createEvidenceArtifactsRepository(db).listForFacts(
    user.id,
    projectSelection ? [projectSelection.factId] : []
  );
  const projectProof = careerContext
    ? selectProjectProof(careerContext.payload.records, projectArtifacts)
    : null;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl space-y-4 pb-12">
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">
              {jobTitle} <span className="font-normal text-muted-foreground">at {jobCompany}</span>
            </h1>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
              {status}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            One role, its documents, and the next action in your application.
          </p>
          {jobUrl ? (
            <a
              href={jobUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View original posting <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </header>

        {guardian.level !== "ok" ? (
          <div>
            <FadiGuardianCallout verdict={guardian} />
            <FadiGuardianVoice verdict={guardian} />
          </div>
        ) : null}

        <JobLivenessBanner jobId={job.id} jobUrl={jobUrl} />

        {!hasJobContext ? (
          <JobContextCard jobId={job.id} initialDescription="" />
        ) : (
          <div className="space-y-4">
            {profile?.autoPrepEnabled && beforeApplying ? (
              <AutoPrepRunner jobId={job.id} enabled hasDocs={jobDocs.length > 0} />
            ) : null}

            <section aria-labelledby="workspace-next-action" className="space-y-2">
              <p
                id="workspace-next-action"
                className="text-xs font-semibold uppercase tracking-wide text-primary"
              >
                {beforeApplying
                  ? "Next: decide whether this role is worth your time"
                  : inInterviewJourney
                    ? "Next: prepare for the conversation"
                    : "Next: record what happened"}
              </p>
              {beforeApplying ? (
                <FitGatePanel
                  jobTitle={jobTitle}
                  jobCompany={jobCompany}
                  jobDescription={jobDescription}
                />
              ) : inInterviewJourney ? (
                <InterviewPrepPanel
                  applicationId={savedApplication?.id}
                  jobId={job.id}
                  jobTitle={jobTitle}
                  jobCompany={jobCompany}
                  jobDescription={jobDescription}
                />
              ) : (
                <ApplicationOutcomePanel
                  jobId={job.id}
                  jobCompany={jobCompany}
                  jobTitle={jobTitle}
                  application={application}
                  autopsyPrompts={[...REJECTION_AUTOPSY_PROMPTS]}
                />
              )}
            </section>

            {beforeApplying ? (
              <>
                <WorkspaceDocActions
                  jobId={job.id}
                  documents={documents}
                  projectProof={projectProof}
                  canDraft
                />
                <ApplicationOutcomePanel
                  jobId={job.id}
                  jobCompany={jobCompany}
                  jobTitle={jobTitle}
                  application={application}
                  autopsyPrompts={[...REJECTION_AUTOPSY_PROMPTS]}
                />
              </>
            ) : null}

            <details className="rounded-xl border border-border/60 bg-card">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                Role details and tools
              </summary>
              <div className="space-y-3 border-t border-border/60 p-4">
                {!beforeApplying ? (
                  <WorkspaceDocActions
                    jobId={job.id}
                    documents={documents}
                    projectProof={projectProof}
                    canDraft={!journeyFinished}
                  />
                ) : null}
                {inInterviewJourney ? (
                  <ApplicationOutcomePanel
                    jobId={job.id}
                    jobCompany={jobCompany}
                    jobTitle={jobTitle}
                    application={application}
                    autopsyPrompts={[...REJECTION_AUTOPSY_PROMPTS]}
                  />
                ) : null}
                {jobDocs.length > 0 ? (
                  <CvReviewPanel
                    jobId={job.id}
                    jobTitle={jobTitle}
                    jobCompany={jobCompany}
                    jobDescription={jobDescription}
                  />
                ) : null}
                {!journeyFinished ? (
                  <CompanyBriefPanel
                    jobTitle={jobTitle}
                    jobCompany={jobCompany}
                    jobDescription={jobDescription}
                  />
                ) : null}
                {jobDocs.length === 0 && journeyFinished ? (
                  <p className="text-sm text-muted-foreground">
                    No additional details for this application.
                  </p>
                ) : null}
              </div>
            </details>
          </div>
        )}
      </div>
    </AppShell>
  );
}
