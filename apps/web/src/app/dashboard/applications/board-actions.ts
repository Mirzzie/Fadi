"use server";

import { revalidatePath } from "next/cache";

import { randomUUID } from "node:crypto";

import {
  createApplicationsRepository,
  createJobsRepository,
  type ApplicationStatus,
} from "@careeros/database";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { generateCareerDocument, NoHistoryError, type DocKind } from "@/lib/documents/generate";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";

type Result = { ok: boolean; message: string; id?: string };

export async function createApplicationAction(input: {
  company: string;
  title: string;
  jobDescription?: string;
  jobId?: string | null;
}): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!input.company.trim() || !input.title.trim()) {
    return { ok: false, message: "Company and role are required." };
  }
  try {
    const db = getDatabase();
    // Pasted jobs get a REAL jobs row, so they're first-class: the full workspace
    // (fit gate, quality score, red-pen review, interview prep, docs) works for
    // them via /applications/{jobId}/workspace — same as discovered jobs.
    let jobId = input.jobId ?? null;
    if (!jobId) {
      const job = await createJobsRepository(db).upsertSeedJob({
        source: "manual",
        externalId: randomUUID(),
        title: input.title.trim(),
        company: input.company.trim(),
        description: input.jobDescription?.trim() || null,
        // NOT "active": the jobs table is a shared pool, and a user's pasted job
        // must never surface on anyone else's board (privacy mandate). "manual"
        // keeps it workspace-able (findById) but out of listActive entirely.
        status: "manual",
      });
      jobId = job.id;
    }

    const app = await createApplicationsRepository(db).createForUser(user.id, {
      company: input.company.trim(),
      title: input.title.trim(),
      jobDescription: input.jobDescription?.trim() || null,
      jobId,
      status: "interested",
    });
    revalidatePath("/dashboard/applications");
    return { ok: true, message: "Added.", id: app.id };
  } catch (error) {
    logger.error("applications.create_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't add the application." };
  }
}

export async function updateApplicationStatusAction(
  id: string,
  status: ApplicationStatus,
): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  try {
    const updated = await createApplicationsRepository(getDatabase()).updateForUser(user.id, id, {
      status,
    });
    if (!updated) return { ok: false, message: "Application not found." };
    revalidatePath("/dashboard/applications");
    return { ok: true, message: "Updated." };
  } catch (error) {
    logger.error("applications.update_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't update." };
  }
}

export async function updateApplicationAction(
  id: string,
  input: { company?: string; title?: string; jobDescription?: string; url?: string },
): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  try {
    const updated = await createApplicationsRepository(getDatabase()).updateForUser(user.id, id, {
      ...(input.company !== undefined ? { company: input.company.trim() } : {}),
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.jobDescription !== undefined ? { jobDescription: input.jobDescription.trim() || null } : {}),
      ...(input.url !== undefined ? { url: input.url.trim() || null } : {}),
    });
    if (!updated) return { ok: false, message: "Application not found." };
    revalidatePath("/dashboard/applications");
    return { ok: true, message: "Saved." };
  } catch (error) {
    logger.error("applications.update_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't save." };
  }
}

/** Fadi drafts a document for THIS application — saved + linked to it. */
export async function generateApplicationDocumentAction(
  applicationId: string,
  kind: DocKind,
): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    const db = getDatabase();
    const app = await createApplicationsRepository(db).getForUser(user.id, applicationId);
    if (!app) return { ok: false, message: "Application not found." };

    const generate = await getUserDocGenerate(user.id);
    if (!generate) {
      return { ok: false, message: "Connect an AI provider in Settings to let Fadi draft documents." };
    }

    const doc = await generateCareerDocument(
      user.id,
      {
        kind,
        jobTitle: app.title,
        company: app.company,
        jobDescription: app.jobDescription,
        jobId: app.jobId,
        applicationId: app.id,
      },
      generate,
    );
    revalidatePath("/dashboard/applications");
    return { ok: true, message: "Drafted.", id: doc.id };
  } catch (error) {
    if (error instanceof NoHistoryError) return { ok: false, message: error.message };
    logger.error("applications.generate_doc_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Fadi couldn't draft that. Check your AI provider and try again." };
  }
}
