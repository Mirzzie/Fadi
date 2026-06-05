"use server";

import { revalidatePath } from "next/cache";

import {
  createApplicationsRepository,
  createJobsRepository,
} from "@careeros/database";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { generateCareerDocument, type DocKind } from "@/lib/documents/generate";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";

type Result = { ok: boolean; message: string; id?: string };

/**
 * Generate a REAL, saved document tailored to this job (using its live job
 * description), linked to the job + an application so it shows up in Documents
 * and the tracker. Opens in the form editor. Same core as the Kai tool.
 */
export async function generateJobDocumentAction(jobId: string, kind: DocKind): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    const db = getDatabase();
    const job = await createJobsRepository(db).findById(jobId);
    if (!job) return { ok: false, message: "Job not found." };

    // Ensure an application row exists (don't clobber an existing status).
    const apps = createApplicationsRepository(db);
    const existing = (await apps.listForUserByJobIds(user.id, [jobId]))[0];
    const application =
      existing ??
      (await apps.createForUser(user.id, {
        jobId,
        company: job.company,
        title: job.title,
        url: job.url,
        status: "interested",
      }));

    const generate = await getUserDocGenerate(user.id);
    if (!generate) {
      return { ok: false, message: "Connect an AI provider in Settings → AI provider first." };
    }

    const doc = await generateCareerDocument(
      user.id,
      {
        kind,
        jobTitle: job.title,
        company: job.company,
        jobDescription: job.description,
        jobId,
        applicationId: application.id,
      },
      generate,
    );

    revalidatePath(`/dashboard/applications/${jobId}/workspace`);
    return { ok: true, message: "Drafted.", id: doc.id };
  } catch (error) {
    logger.error("workspace.generate_doc_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Kai couldn't draft that. Check your AI provider and try again." };
  }
}
