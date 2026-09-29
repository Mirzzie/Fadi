"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createApplicationsRepository,
  createCareerProfilesRepository,
  createDocumentsRepository,
  createJobsRepository,
} from "@careeros/database";
import { resolveApplicationJobContext } from "@/lib/applications/job-context";
import { syncApplicationWork } from "@/lib/applications/sync-work";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { AiRateLimitError, getUserDocGenerate } from "@/lib/ai/user-generate";
import { generateCareerDocument, NoHistoryError, type DocKind } from "@/lib/documents/generate";
import { getDatabase } from "@/lib/database/client";
import { checkPostingLiveness, type PostingLiveness } from "@/lib/jobs/liveness";
import { logger } from "@/lib/observability/logger";

type Result = { ok: boolean; message: string; id?: string };

const jobDescriptionSchema = z.string().trim().min(50).max(50_000);

/** Save one authoritative posting copy for every tool in this application workspace. */
export async function saveWorkspaceJobDescriptionAction(
  jobId: string,
  rawDescription: string
): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const parsed = jobDescriptionSchema.safeParse(rawDescription);
  if (!parsed.success) {
    return { ok: false, message: "Paste at least 50 characters from the job posting." };
  }

  try {
    const db = getDatabase();
    const job = await createJobsRepository(db).findByIdForUser(user.id, jobId);
    if (!job) return { ok: false, message: "Job not found." };

    const applications = createApplicationsRepository(db);
    const existing = (await applications.listForUserByJobIds(user.id, [jobId]))[0];
    const activeTrack = existing
      ? null
      : await createCareerProfilesRepository(db)
          .getActiveForUser(user.id)
          .catch(() => null);
    const application = existing
      ? await applications.updateForUser(user.id, existing.id, {
          jobDescription: parsed.data,
        })
      : await applications.createForUser(user.id, {
          jobId,
          company: job.company,
          title: job.title,
          url: job.url,
          jobDescription: parsed.data,
          careerProfileId: activeTrack?.id ?? null,
          status: "interested",
        });
    if (application) await syncApplicationWork(user.id, application);

    revalidatePath(`/dashboard/applications/${jobId}/workspace`);
    return { ok: true, message: "Job description saved." };
  } catch (error) {
    logger.error("workspace.save_job_description_failed", {
      userId: user.id,
      jobId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Fadi couldn't save the job description." };
  }
}

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

  const job = await createJobsRepository(getDatabase()).findByIdForUser(user.id, jobId);
  if (!job) return { state: "unknown", reason: "Job not found", checkedAt };

  if (job.status === "closed" || job.status === "expired" || job.status === "archived") {
    return { state: "closed", reason: "No longer listed in Fadi", checkedAt };
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
    const job = await createJobsRepository(db).findByIdForUser(user.id, jobId);
    if (!job) return { ok: false, message: "Job not found." };

    // Ensure an application row exists (don't clobber an existing status).
    const apps = createApplicationsRepository(db);
    const existing = (await apps.listForUserByJobIds(user.id, [jobId]))[0];
    const context = resolveApplicationJobContext(job, existing);
    if (!context.description) {
      return { ok: false, message: "Add the job description before drafting documents." };
    }

    const activeTrack = existing
      ? null
      : await createCareerProfilesRepository(db)
          .getActiveForUser(user.id)
          .catch(() => null);
    const application =
      existing ??
      (await apps.createForUser(user.id, {
        jobId,
        company: context.company,
        title: context.title,
        url: context.url,
        jobDescription: context.description,
        careerProfileId: activeTrack?.id ?? null,
        status: "interested",
      }));
    await syncApplicationWork(user.id, application);

    const generate = await getUserDocGenerate(user.id);
    if (!generate) {
      return { ok: false, message: "Connect an AI provider in Settings → AI provider first." };
    }

    const doc = await generateCareerDocument(
      user.id,
      {
        kind,
        jobTitle: context.title,
        company: context.company,
        jobDescription: context.description,
        jobId,
        applicationId: application.id,
      },
      generate
    );

    revalidatePath(`/dashboard/applications/${jobId}/workspace`);
    // Surface honest degradation rather than reporting a bare success: the draft is
    // real, but the user needs to know what it was built WITHOUT (F3).
    return { ok: true, message: doc.evidenceNotice ?? "Drafted.", id: doc.id };
  } catch (error) {
    if (error instanceof NoHistoryError) return { ok: false, message: error.message };
    // Not a failure — their allowance simply reset window. Say so plainly.
    if (error instanceof AiRateLimitError) return { ok: false, message: error.message };
    logger.error("workspace.generate_doc_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return {
      ok: false,
      message: "Fadi couldn't draft that. Check your AI provider and try again.",
    };
  }
}

// Auto-prep creates the two documents normally required for an application.
const AUTO_PREP_KINDS: DocKind[] = ["resume", "cover_letter"];

type AutoPrepResult = { ok: boolean; message: string; created: number };

/**
 * Auto-prepare the normal application documents for a job: resume and cover
 * letter. Idempotent: only generates the kinds
 * that don't already have a document for this job, so re-running (or a manual
 * draft the user already made) is never clobbered. Triggered by the workspace
 * when the user has opted into auto-prep; manual stays the default.
 */
export async function autoPrepJobAction(jobId: string): Promise<AutoPrepResult> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again.", created: 0 };

  try {
    const db = getDatabase();
    const job = await createJobsRepository(db).findByIdForUser(user.id, jobId);
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
    const context = resolveApplicationJobContext(job, existingApp);
    if (!context.description) {
      return {
        ok: false,
        message: "Add the job description before Fadi prepares documents.",
        created: 0,
      };
    }

    const application =
      existingApp ??
      (await apps.createForUser(user.id, {
        jobId,
        company: context.company,
        title: context.title,
        url: context.url,
        jobDescription: context.description,
        status: "interested",
      }));
    await syncApplicationWork(user.id, application);

    let created = 0;
    for (const kind of todo) {
      try {
        await generateCareerDocument(
          user.id,
          {
            kind,
            jobTitle: context.title,
            company: context.company,
            jobDescription: context.description,
            jobId,
            applicationId: application.id,
          },
          generate
        );
        created += 1;
      } catch (err) {
        // No history means EVERY kind will fail identically — stop and say so.
        if (err instanceof NoHistoryError) {
          return { ok: false, message: err.message, created };
        }
        // Same reasoning for the allowance: the next three kinds cannot succeed
        // either, and retrying them would hammer a limit we already hit. Keep what
        // was drafted and report honestly.
        if (err instanceof AiRateLimitError) {
          return { ok: false, message: err.message, created };
        }
        // Otherwise one weak/failed generation shouldn't sink the whole packet.
        logger.warn("workspace.auto_prep_doc_failed", {
          userId: user.id,
          kind,
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    revalidatePath(`/dashboard/applications/${jobId}/workspace`);
    logger.info("workspace.auto_prep.completed", {
      userId: user.id,
      jobId,
      created,
      requested: todo.length,
    });

    if (created === 0) {
      return {
        ok: false,
        message: "Fadi couldn't draft the packet. Check your AI provider.",
        created: 0,
      };
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
