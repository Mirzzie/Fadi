import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { MockInterview, type PracticeJob } from "@/components/interview/mock-interview";
import { StoryBank } from "@/components/interview/story-bank";
import { resolveApplicationJobContext } from "@/lib/applications/job-context";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDashboardProfileSummary } from "@/lib/career-report/data";
import { listStories } from "@/lib/interview/story-bank";
import { onboardingStatusOf } from "@/lib/onboarding/status";

export const metadata: Metadata = { title: "Interview prep" };
export const dynamic = "force-dynamic";

export default async function InterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in?next=/dashboard/interview");

  const [stories, profile, params] = await Promise.all([
    listStories(user.id),
    getDashboardProfileSummary(user.id),
    searchParams,
  ]);

  // Practising for one posting: its title and description seed the session, so the questions are
  // about the job in front of them rather than their direction in general. Scoped to what this
  // person may read — a private capture belongs to its owner.
  const job = params.jobId ? await practiceJobFor(user.id, params.jobId) : null;

  // Gate on the summary we already loaded — no separate profiles round-trip.
  if (onboardingStatusOf(profile) !== "completed") redirect("/onboarding");

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
        <MockInterview
          job={job}
          defaults={{
            role: profile?.targetRole ?? "",
            country: profile?.locationPreference ?? "",
            seniority: profile?.experienceLevel ?? "",
          }}
        />
      </div>
      <StoryBank stories={stories} />
    </AppShell>
  );
}

/** The posting to practise for, or null when it is missing or belongs to somebody else. */
async function practiceJobFor(userId: string, jobId: string): Promise<PracticeJob | null> {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  const { createApplicationsRepository, createJobsRepository } = await import("@careeros/database");
  const { getDatabase } = await import("@/lib/database/client");
  const db = getDatabase();
  const [job, applications] = await Promise.all([
    createJobsRepository(db).findByIdForUser(userId, jobId),
    createApplicationsRepository(db).listForUserByJobIds(userId, [jobId]),
  ]);
  if (!job) return null;
  return resolveApplicationJobContext(job, applications[0]);
}
