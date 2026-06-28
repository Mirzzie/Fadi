"use server";

import { revalidatePath } from "next/cache";

import {
  createApplicationsRepository,
  createDocumentsRepository,
  createJobsRepository,
} from "@careeros/database";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { generateCareerDocument, type DocKind } from "@/lib/documents/generate";
import { getDatabase } from "@/lib/database/client";
import { checkPostingLiveness, type PostingLiveness } from "@/lib/jobs/liveness";
import { logger } from "@/lib/observability/logger";

type Result = { ok: boolean; message: string; id?: string };

/**
 * Is this posting still open? Saves the user from pouring effort into a role
 * that's already closed. If we've already archived/expired the job in our own
 * store, that's authoritative — answer instantly with no network call.
 * Otherwise probe the live URL (best-effort, conservative — see liveness.ts).
 */
export async function checkJobLivenessAction(jobId: string): Promise<PostingLiveness> {
  const checkedAt = new Date().toISOString();
  const user = await getCurrentAuthUser();
  if (!user) return { state: "unknown", reason: "Not signed in", checkedAt };

  const job = await createJobsRepository(getDatabase()).findById(jobId);
  if (!job) return { state: "unknown", reason: "Job not found", checkedAt };

  if (job.status === "closed" || job.status === "expired" || job.status === "archived") {
    return { state: "closed", reason: "No longer listed in FadiOS", checkedAt };
  }
  if (!job.url) {
    return { state: "unknown", reason: "No source link to verify", checkedAt };
  }

  const result = await checkPostingLiveness(job.url);
  // Persist so a confirmed-closed role leaves the board for EVERYONE (and survives
  // re-sync), and so we don't re-probe the same URL on the next render.
  try {
    await createJobsRepository(getDatabase()).setJobLiveness(job.id, result.state);
  } catch {
    // Best-effort — the banner still shows the live result.
  }
  return result;
}

/**
 * Generate a REAL, saved document tailored to this job (using its live job
 * description), linked to the job + an application so it shows up in Documents
 * and the tracker. Opens in the form editor. Same core as the Fadi tool.
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
    return { ok: false, message: "Fadi couldn't draft that. Check your AI provider and try again." };
  }
}

// The full packet Fadi prepares when auto-prep is on (the four DocKinds).
const AUTO_PREP_KINDS: DocKind[] = ["resume", "cover_letter", "email", "value_proposition"];

type AutoPrepResult = { ok: boolean; message: string; created: number };

/**
 * Auto-prepare the full application packet for a job — CV, cover letter, cold
 * email, value proposition — in one go. Idempotent: only generates the kinds
 * that don't already have a document for this job, so re-running (or a manual
 * draft the user already made) is never clobbered. Triggered by the workspace
 * when the user has opted into auto-prep; manual stays the default.
 */
export async function autoPrepJobAction(jobId: string): Promise<AutoPrepResult> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again.", created: 0 };

  try {
    const db = getDatabase();
    const job = await createJobsRepository(db).findById(jobId);
    if (!job) return { ok: false, message: "Job not found.", created: 0 };

    const generate = await getUserDocGenerate(user.id);
    if (!generate) {
      return {
        ok: false,
        message: "Connect an AI provider in Settings → AI provider first.",
        created: 0,
      };
    }

    const docsRepo = createDocumentsRepository(db);
    const existing = await docsRepo.listForJob(user.id, jobId);
    const haveKinds = new Set(existing.map((d) => d.kind));
    const todo = AUTO_PREP_KINDS.filter((k) => !haveKinds.has(k));
    if (todo.length === 0) {
      return { ok: true, message: "Packet already prepared.", created: 0 };
    }

    // Ensure an application row exists (don't clobber an existing status).
    const apps = createApplicationsRepository(db);
    const existingApp = (await apps.listForUserByJobIds(user.id, [jobId]))[0];
    const application =
      existingApp ??
      (await apps.createForUser(user.id, {
        jobId,
        company: job.company,
        title: job.title,
        url: job.url,
        status: "interested",
      }));

    let created = 0;
    for (const kind of todo) {
      try {
        await generateCareerDocument(
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
        created += 1;
      } catch (err) {
        // One weak/failed generation shouldn't sink the whole packet.
        logger.warn("workspace.auto_prep_doc_failed", {
          userId: user.id,
          kind,
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    revalidatePath(`/dashboard/applications/${jobId}/workspace`);
    logger.info("workspace.auto_prep.completed", { userId: user.id, jobId, created, requested: todo.length });

    if (created === 0) {
      return { ok: false, message: "Fadi couldn't draft the packet. Check your AI provider.", created: 0 };
    }
    return {
      ok: true,
      message: `Fadi prepared ${created} document${created === 1 ? "" : "s"} for this role.`,
      created,
    };
  } catch (error) {
    logger.error("workspace.auto_prep_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Auto-prep failed. Try again or draft manually.", created: 0 };
  }
}
