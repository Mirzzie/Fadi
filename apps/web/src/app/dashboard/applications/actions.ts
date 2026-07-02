"use server";

import { createApplicationsRepository } from "@careeros/database";
import { revalidatePath } from "next/cache";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";
import {
  completeRejectionAutopsy,
  logRejection,
  type LogRejectionResult,
} from "@/lib/resilience/service";
import type { RejectionInsight } from "@/lib/resilience/autopsy";
import { evaluateFit, type FitResult } from "@/lib/jobs/fit";
import { prepareInterviewForJob, type PrepResult } from "@/lib/interview/jd-prep";
import { prepareCompanyBrief, type BriefResult } from "@/lib/interview/company-brief";
import {
  scoreApplication,
  type ApplicationQualityResult,
} from "@/lib/intelligence/application-quality";
import { getCareerReportContext } from "@/lib/career-report/data";
import { createDocumentsRepository } from "@careeros/database";
import { parseResume, resumeToPlainText } from "@/lib/documents/resume";
import {
  reviewToGuidance,
  runDocReview,
  type CvReview,
  type CvReviewResult,
  type ReviewableKind,
} from "@/lib/documents/cv-review";
import { generateCareerDocument, NoHistoryError } from "@/lib/documents/generate";
import { isProseKind, letterToPlainText, parseLetter } from "@/lib/documents/letter";
import { getUserDocGenerate } from "@/lib/ai/user-generate";

export type RejectionStage = "keyword" | "screen" | "interview" | "final";

function workspacePath(jobId: string) {
  return `/dashboard/applications/${jobId}/workspace`;
}

/**
 * Mark an application as sent. This is the provenance precondition for logging a
 * rejection — momentum is intentionally NOT awarded here (clicking a button is
 * not forward motion). It only records the honest fact that the application went
 * out, so a later rejection can be verified and learned from.
 */
export async function markApplicationApplied(input: {
  jobId: string;
  company: string;
  title: string;
  url?: string | null;
}): Promise<{ ok: boolean; applicationId?: string; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    const application = await createApplicationsRepository(getDatabase()).upsertStatusForUser(
      user.id,
      {
        jobId: input.jobId,
        company: input.company,
        title: input.title,
        url: input.url ?? null,
        status: "applied",
      },
    );

    revalidatePath(workspacePath(input.jobId));
    return { ok: true, applicationId: application.id, message: "Marked as applied." };
  } catch (error) {
    logger.error("applications.mark_applied_failed", {
      userId: user.id,
      jobId: input.jobId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

/**
 * Fit gate — should the user even apply to this job? Runs the honest, anti-spray
 * fit check (worth-your-time, BEFORE applying) against their real evidence. No
 * persistence: it guides the decision in the moment.
 */
export async function evaluateJobFit(input: {
  jobTitle: string;
  company: string;
  jobDescription: string;
}): Promise<FitResult> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, reason: "error", message: "Please sign in again." };
  return evaluateFit(user.id, {
    jobDescription: input.jobDescription,
    jobTitle: input.jobTitle,
    company: input.company,
  });
}

export type ScoreApplicationResult =
  | { ok: true; result: ApplicationQualityResult }
  | { ok: false; message: string };

/**
 * Score the resume you're about to send AGAINST this specific job — keyword
 * coverage, formatting/ATS risk, specificity, AI-dismiss risk, and the concrete
 * fixes that would move the needle. Scores the resume tailored for THIS job when
 * one exists, else the base resume. The honest "is it ready to send?" gate that
 * the fit check points you toward.
 */
export async function scoreApplicationDraft(input: {
  jobId: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
}): Promise<ScoreApplicationResult> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const jd = (input.jobDescription ?? "").trim();
  if (!jd) {
    return {
      ok: false,
      message:
        "Add the job description in the workspace first — I score your resume against the real posting, not a guess.",
    };
  }

  try {
    const { ctx, resumeText } = await resolveResumeForJob(user.id, input.jobId);

    if (!resumeText) {
      return {
        ok: false,
        message:
          "I couldn't find a resume to score. Add yours in Profile, or draft one in this workspace, then run the check.",
      };
    }

    const result = await scoreApplication(
      {
        jobTitle: input.jobTitle,
        jobCompany: input.company,
        jobDescription: jd,
        resumeText,
        targetRole: ctx?.targetRole ?? undefined,
        experienceLevel: ctx?.experienceLevel ?? undefined,
        careerGoals: ctx?.careerGoals ?? undefined,
      },
      user.id,
    );

    return { ok: true, result };
  } catch (error) {
    logger.error("applications.score_failed", {
      userId: user.id,
      jobId: input.jobId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Something went wrong scoring this application. Please try again." };
  }
}

/** The CV the user would actually send for this job: the tailored resume doc when
 *  one exists, else the active direction's base resume (shared by score + review). */
async function resolveResumeForJob(userId: string, jobId: string) {
  const db = getDatabase();
  const [ctx, jobDocs] = await Promise.all([
    getCareerReportContext(userId),
    createDocumentsRepository(db).listForJob(userId, jobId),
  ]);
  const resumeDoc = jobDocs.find((d) => d.kind === "resume");
  let resumeText = resumeDoc ? resumeToPlainText(parseResume(resumeDoc.content)).trim() : "";
  if (!resumeText) resumeText = (ctx?.resumeText ?? "").trim();
  return { ctx, resumeText };
}

/** The document text the user would actually send for this job, per kind. */
async function resolveDocForJob(userId: string, jobId: string, kind: ReviewableKind): Promise<string> {
  if (kind === "resume") {
    const { resumeText } = await resolveResumeForJob(userId, jobId);
    return resumeText;
  }
  const jobDocs = await createDocumentsRepository(getDatabase()).listForJob(userId, jobId);
  const doc = jobDocs.find((d) => d.kind === kind);
  if (!doc) return "";
  return isProseKind(doc.kind) ? letterToPlainText(parseLetter(doc.content, doc.kind)).trim() : doc.content.trim();
}

/**
 * The red-pen review — a brutally honest, section-by-section recruiter review of
 * the CV / cover letter / cold email / value proposition against THIS job, with
 * before/after rewrites. Deep dive; the quality scorer above stays the quick gate.
 */
export async function reviewDocForJob(input: {
  jobId: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  kind: ReviewableKind;
}): Promise<CvReviewResult> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, reason: "error", message: "Please sign in again." };

  try {
    const generate = await getUserDocGenerate(user.id);
    if (!generate) {
      return {
        ok: false,
        reason: "no_provider",
        message: "Connect an AI provider in Settings → AI provider and I'll review your documents like a recruiter.",
      };
    }

    const docText = await resolveDocForJob(user.id, input.jobId, input.kind);
    const result = await runDocReview(generate, {
      kind: input.kind,
      jobTitle: input.jobTitle,
      company: input.company,
      jobDescription: input.jobDescription,
      docText,
    });
    if (result.ok) {
      logger.info("applications.doc_review.completed", {
        userId: user.id,
        jobId: input.jobId,
        kind: input.kind,
        sections: result.review.sections.length,
        decision: result.review.hireProbability.decision,
      });
    }
    return result;
  } catch (error) {
    logger.error("applications.doc_review_failed", {
      userId: user.id,
      jobId: input.jobId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, reason: "error", message: "Something went wrong reviewing this document. Please try again." };
  }
}

/**
 * The review→redraft loop: regenerate the document with the red-pen fixes folded
 * in — the reviewer's rewrites become the next draft (grounded in real evidence;
 * [ADD REAL NUMBER] placeholders survive for the user to fill honestly).
 */
export async function applyReviewFixes(input: {
  jobId: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  kind: ReviewableKind;
  review: CvReview;
}): Promise<{ ok: boolean; message: string; docId?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    const generate = await getUserDocGenerate(user.id);
    if (!generate) {
      return { ok: false, message: "Connect an AI provider in Settings → AI provider first." };
    }

    const doc = await generateCareerDocument(
      user.id,
      {
        kind: input.kind,
        jobTitle: input.jobTitle,
        company: input.company,
        jobDescription: input.jobDescription,
        jobId: input.jobId,
        guidance: reviewToGuidance(input.review),
      },
      generate,
    );

    revalidatePath(workspacePath(input.jobId));
    logger.info("applications.review_fixes_applied", { userId: user.id, jobId: input.jobId, kind: input.kind });
    return { ok: true, message: "Redrafted with the fixes — review it in the editor before sending.", docId: doc.id };
  } catch (error) {
    if (error instanceof NoHistoryError) return { ok: false, message: error.message };
    logger.error("applications.apply_fixes_failed", {
      userId: user.id,
      jobId: input.jobId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't redraft just now. Check your AI provider and try again." };
  }
}

/** An honest company prep brief — understand the business + smart questions to ask. */
export async function getCompanyBrief(input: {
  company: string;
  role?: string;
  jobDescription?: string;
}): Promise<BriefResult> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, reason: "error", message: "Please sign in again." };
  return prepareCompanyBrief(user.id, input);
}

/**
 * JD-tailored STAR interview prep — Fadi infers the likely behavioral questions
 * for this role and drafts answers from the user's REAL LinkedIn/career evidence.
 */
export async function prepareInterview(input: {
  jobTitle: string;
  company: string;
  jobDescription: string;
}): Promise<PrepResult> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, reason: "error", message: "Please sign in again." };
  return prepareInterviewForJob(user.id, {
    jobDescription: input.jobDescription,
    jobTitle: input.jobTitle,
    company: input.company,
  });
}

/** Log a rejection against a real, sent application and open the autopsy. */
export async function logApplicationRejection(input: {
  jobId: string;
  applicationId: string;
  stage: RejectionStage | null;
}): Promise<LogRejectionResult> {
  const user = await getCurrentAuthUser();
  if (!user) {
    return { ok: false, reason: "not_found", message: "Please sign in again." };
  }

  const result = await logRejection(user.id, input.applicationId, input.stage);
  if (result.ok) revalidatePath(workspacePath(input.jobId));
  return result;
}

/** Submit the rejection autopsy — where the real, process-based reward lands. */
export async function submitRejectionAutopsy(input: {
  jobId: string;
  applicationId: string;
  reflection: { stage?: string; feedback?: string; lesson?: string; nextAction?: string };
}): Promise<
  | { ok: true; message: string; momentum: number; delta: number; band: string; insight: RejectionInsight }
  | { ok: false; message: string }
> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    const motion = await completeRejectionAutopsy(user.id, input.applicationId, input.reflection);
    revalidatePath(workspacePath(input.jobId));
    return {
      ok: true,
      message: motion.message,
      momentum: motion.momentum,
      delta: motion.delta,
      band: motion.band,
      insight: motion.insight,
    };
  } catch (error) {
    logger.error("applications.autopsy_failed", {
      userId: user.id,
      applicationId: input.applicationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Something went wrong saving your reflection. Please try again." };
  }
}
