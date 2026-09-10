import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import {
  createApplicationsRepository,
  createCareerProfilesRepository,
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
import { LeadEvidencePanel } from "@/components/workspace/lead-evidence-panel";
import { ApplicationQualityPanel } from "@/components/workspace/application-quality-panel";
import { CvReviewPanel } from "@/components/workspace/cv-review-panel";
import { InterviewPrepPanel } from "@/components/workspace/interview-prep-panel";
import { CompanyBriefPanel } from "@/components/workspace/company-brief-panel";
import { AutoPrepRunner } from "@/components/workspace/auto-prep-runner";
import { JobLivenessBanner } from "@/components/workspace/job-liveness-banner";
import { WorkspaceDocActions } from "@/components/workspace/workspace-doc-actions";
import { WorkspaceSection } from "@/components/workspace/workspace-section";
import { FadiGuardianCallout } from "@/components/workspace/fadi-guardian-callout";
import { FadiGuardianVoice } from "@/components/os/fadi-guardian-voice";
import { scoreJobForUser } from "@/lib/jobs/job-matching";
import { evaluateApply } from "@/lib/guardian/guardian";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { onboardingStatusOf } from "@/lib/onboarding/status";
import { REJECTION_AUTOPSY_PROMPTS } from "@/lib/resilience/framing";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ jobId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { jobId } = await params;
  const user = await getCurrentAuthUser();
  if (!user) return { title: "Application Workspace" };
  const db = getDatabase();
  // Owner-scoped: never put another user's private job title in the tab.
  const job = await createJobsRepository(db).findByIdForUser(user.id, jobId);
  if (!job) return { title: "Application Workspace" };
  return { title: `${job.title} at ${job.company} — Workspace` };
}

export default async function ApplicationWorkspacePage({ params }: Props) {
  const { jobId } = await params;

  const user = await getCurrentAuthUser();

  if (!user) redirect("/auth/sign-in");

  const db = getDatabase();

  const [job, savedJob, applications, jobDocs, profile, track] = await Promise.all([
    createJobsRepository(db).findByIdForUser(user.id, jobId),
    createSavedJobsRepository(db).listForUserByJobIds(user.id, [jobId]),
    createApplicationsRepository(db).listForUserByJobIds(user.id, [jobId]),
    createDocumentsRepository(db).listForJob(user.id, jobId),
    createProfilesRepository(db).getByUserId(user.id),
    createCareerProfilesRepository(db).getActiveForUser(user.id),
  ]);

  // Gate on the profile already loaded above — no second profiles round-trip.
  if (onboardingStatusOf(profile) !== "completed") redirect("/onboarding");
  if (!job) notFound();

  // The Action Guardian: Fadi checks this role against your active direction and
  // speaks up (a nudge, never a block) if it's off-track or above your stage.
  const match = scoreJobForUser({ careerProfile: track, resume: null, job });
  const guardian = evaluateApply({
    onRole: match.onRole,
    fieldRelated: match.fieldRelated,
    overLevel: match.overLevel,
    targetRole: track?.targetRole ?? null,
    jobTitle: job.title,
  });

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
            {job.title} <span className="text-muted-foreground font-normal">at {job.company}</span>
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

        {/* Fadi speaks up — guards this application against your career direction */}
        {guardian.level !== "ok" ? (
          <div className="shrink-0">
            <FadiGuardianCallout verdict={guardian} />
            <FadiGuardianVoice verdict={guardian} />
          </div>
        ) : null}

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

        {/* Real, saved, JD-tailored documents for this job — the core artifacts stay visible */}
        <div className="shrink-0">
          <WorkspaceDocActions
            jobId={job.id}
            documents={jobDocs.map((d) => ({ id: d.id, kind: d.kind, title: d.title }))}
          />
        </div>

        {/* The tools, progressively disclosed (Hick's law): each is one self-describing
            row, one click away — in journey order: decide → perfect → prep → learn. */}
        <div className="shrink-0 space-y-2">
          <WorkspaceSection
            icon="fit"
            title="Should you apply?"
            hint="An honest fit check before you invest time"
          >
            <FitGatePanel
              jobTitle={job.title}
              jobCompany={job.company}
              jobDescription={job.description ?? undefined}
            />
          </WorkspaceSection>
          {/* Sits between go/no-go and ready-to-send on purpose: once you've decided
              to apply, the next real decision is what leads — not another score. */}
          <WorkspaceSection
            icon="lead"
            title="What should lead here?"
            hint="Which of your evidence goes first for this role"
          >
            <LeadEvidencePanel jobTitle={job.title} jobDescription={job.description ?? undefined} />
          </WorkspaceSection>
          <WorkspaceSection
            icon="quality"
            title="Is it ready to send?"
            hint="Score your resume against this exact posting"
          >
            <ApplicationQualityPanel
              jobId={job.id}
              jobTitle={job.title}
              jobCompany={job.company}
              jobDescription={job.description ?? undefined}
            />
          </WorkspaceSection>
          <WorkspaceSection
            icon="redpen"
            title="Red-pen review"
            hint="Recruiter markup of any document, with rewrites"
          >
            <CvReviewPanel
              jobId={job.id}
              jobTitle={job.title}
              jobCompany={job.company}
              jobDescription={job.description ?? undefined}
            />
          </WorkspaceSection>
          <WorkspaceSection
            icon="interview"
            title="Interview prep"
            hint="Likely questions + STAR answers from your real experience"
          >
            <InterviewPrepPanel
              jobTitle={job.title}
              jobCompany={job.company}
              jobDescription={job.description ?? undefined}
            />
          </WorkspaceSection>
          <WorkspaceSection
            icon="company"
            title="Company brief"
            hint="Understand the business + smart questions to ask"
          >
            <CompanyBriefPanel
              jobTitle={job.title}
              jobCompany={job.company}
              jobDescription={job.description ?? undefined}
            />
          </WorkspaceSection>
          <WorkspaceSection
            icon="outcome"
            title="Outcome & learning"
            hint="Log the result — rejections become data, not verdicts"
          >
            <ApplicationOutcomePanel
              jobId={job.id}
              jobCompany={job.company}
              jobTitle={job.title}
              application={application}
              autopsyPrompts={[...REJECTION_AUTOPSY_PROMPTS]}
            />
          </WorkspaceSection>
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
