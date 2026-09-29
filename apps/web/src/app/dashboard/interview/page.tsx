import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createInterviewSessionsRepository } from "@careeros/database";

import { AppShell } from "@/components/layout/app-shell";
import {
  MockInterview,
  type PracticeJob,
  type PracticeSession,
} from "@/components/interview/mock-interview";
import { resolveApplicationJobContext } from "@/lib/applications/job-context";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDashboardProfileSummary } from "@/lib/career-report/data";
import { getDatabase } from "@/lib/database/client";
import type { MockQuestion } from "@/lib/interview/mock";
import { onboardingStatusOf } from "@/lib/onboarding/status";

export const metadata: Metadata = { title: "Interview prep" };
export const dynamic = "force-dynamic";

export default async function InterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string; sessionId?: string }>;
}) {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in?next=/dashboard/interview");

  const [profile, params] = await Promise.all([getDashboardProfileSummary(user.id), searchParams]);

  // Session ownership is checked before stored questions reach the browser. Its job restores
  // the exact application context when Today sends the person back after a refresh.
  const stored =
    params.sessionId && /^[0-9a-f-]{36}$/i.test(params.sessionId)
      ? await createInterviewSessionsRepository(getDatabase()).getForUser(user.id, params.sessionId)
      : null;
  const initialSession = stored?.status === "active" ? practiceSessionFrom(stored) : null;
  const jobId = params.jobId ?? stored?.jobId ?? null;
  const job = jobId ? await practiceJobFor(user.id, jobId) : null;

  if (onboardingStatusOf(profile) !== "completed") redirect("/onboarding");

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
        <MockInterview
          job={job}
          initialSession={initialSession}
          defaults={{
            role: profile?.targetRole ?? "",
            country: profile?.locationPreference ?? "",
            seniority: profile?.experienceLevel ?? "",
          }}
        />
      </div>
    </AppShell>
  );
}

/** The posting to practise for, or null when it is missing or belongs to somebody else. */
async function practiceJobFor(userId: string, jobId: string): Promise<PracticeJob | null> {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  const { createApplicationsRepository, createJobsRepository } = await import("@careeros/database");
  const db = getDatabase();
  const [job, applications] = await Promise.all([
    createJobsRepository(db).findByIdForUser(userId, jobId),
    createApplicationsRepository(db).listForUserByJobIds(userId, [jobId]),
  ]);
  if (!job) return null;
  return {
    ...resolveApplicationJobContext(job, applications[0]),
    jobId: job.id,
    applicationId: applications[0]?.id ?? null,
  };
}

function practiceSessionFrom(row: {
  id: string;
  role: string;
  company: string | null;
  stage: string;
  durationMinutes: number;
  questions: Record<string, unknown>[];
}): PracticeSession | null {
  const questions: MockQuestion[] = row.questions.flatMap((value) => {
    if (
      typeof value.question !== "string" ||
      !["opener", "behavioral", "role", "situational"].includes(String(value.kind))
    ) {
      return [];
    }
    return [
      {
        question: value.question,
        kind: value.kind as MockQuestion["kind"],
        ...(typeof value.competency === "string" ? { competency: value.competency } : {}),
      },
    ];
  });
  if (questions.length === 0) return null;
  return {
    id: row.id,
    role: row.role,
    company: row.company,
    stage: row.stage as PracticeSession["stage"],
    durationMinutes: row.durationMinutes as PracticeSession["durationMinutes"],
    questions,
  };
}
