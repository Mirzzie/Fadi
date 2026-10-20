"use server";

import { z } from "zod";

import { createDocumentsRepository, createJobsRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { runDocReview, type CvReviewResult, type ReviewableKind } from "@/lib/documents/cv-review";
import { logger } from "@/lib/observability/logger";

/**
 * SCORE THE DOCUMENT IN FRONT OF YOU, against the job it was written for.
 *
 * The review already existed (`cv-review.ts` — score, missing keywords, six-second impression,
 * recruiter markup) and the editor already loaded the job's description for the truth gate, but
 * nothing ever put the two together: the person edited a CV for a specific posting with no idea
 * how it read against it. They were going elsewhere for that number.
 *
 * Scores what is SAVED, and says so — a score for text that has since been edited would be a
 * number about a document that no longer exists.
 */

const REVIEWABLE: ReviewableKind[] = ["resume", "cover_letter"];

export async function reviewOpenDocumentAction(input: {
  documentId: string;
}): Promise<
  | { ok: true; review: Extract<CvReviewResult, { ok: true }>["review"]; job: { title: string; company: string } }
  | { ok: false; message: string }
> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.documentId);
  if (!id.success) return { ok: false, message: "Unknown document." };

  const db = getDatabase();
  const doc = await createDocumentsRepository(db).getForUser(user.id, id.data);
  if (!doc) return { ok: false, message: "That document is unavailable." };
  if (!REVIEWABLE.includes(doc.kind as ReviewableKind)) {
    return { ok: false, message: "This kind of document isn't scored against a posting." };
  }
  if (!doc.jobId) {
    return {
      ok: false,
      message: "This document isn't linked to a job, so there's nothing to score it against.",
    };
  }

  const job = await createJobsRepository(db).findByIdForUser(user.id, doc.jobId);
  if (!job) return { ok: false, message: "The job this document was written for is no longer available." };
  if (!job.description?.trim()) {
    return {
      ok: false,
      message: "That posting has no description saved, so a score against it would be guesswork. Paste the description on the application first.",
    };
  }

  const generate = await getUserDocGenerate(user.id);
  if (!generate) {
    return { ok: false, message: "Scoring needs an AI provider — add one in Settings → AI." };
  }

  const result = await runDocReview(generate, {
    kind: doc.kind as ReviewableKind,
    jobTitle: job.title,
    company: job.company,
    jobDescription: job.description,
    docText: doc.content,
  });
  if (!result.ok) return { ok: false, message: result.message };

  logger.info("documents.reviewed_against_job", {
    userId: user.id,
    documentId: doc.id,
    score: result.review.atsScore,
  });
  return { ok: true, review: result.review, job: { title: job.title, company: job.company } };
}
