"use server";

import {
  createCareerProfilesRepository,
  createLinkedInProfilesRepository,
  createProfilesRepository,
  createResumesRepository,
  createUsersRepository,
} from "@careeros/database";
import { revalidatePath } from "next/cache";

import { signOutAction } from "@/app/auth/actions";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { detectDocType, extractDocumentText } from "@/lib/documents/extract-text";
import { logger } from "@/lib/observability/logger";

type Result = { ok: boolean; message: string };

const MAX_CV_FILE_BYTES = 8 * 1024 * 1024; // 8MB — generous for any real CV

export type ExtractCvResult = { ok: boolean; message: string; text?: string };

/**
 * Extract plain text from an uploaded CV (PDF/DOCX/DOC/TXT). The text is
 * returned to the form — NOT saved directly — so the user reviews exactly what
 * was parsed before it becomes the evidence Kai reasons from.
 */
export async function extractCvTextAction(formData: FormData): Promise<ExtractCvResult> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file first." };
  }
  if (file.size > MAX_CV_FILE_BYTES) {
    return { ok: false, message: "That file is over 8MB — export a lighter copy and retry." };
  }

  const type = detectDocType(file.name, file.type);
  if (!type || type === "json") {
    return { ok: false, message: "Unsupported file type. Upload a PDF, DOCX, DOC or TXT file." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = (await extractDocumentText(buffer, file.name, file.type)).trim();
    if (!text) {
      return {
        ok: false,
        message:
          "Couldn't read any text from that file — if it's a scanned/image PDF, export a text-based copy instead.",
      };
    }
    return { ok: true, message: `Parsed ${file.name} — review the text below, then save.`, text };
  } catch (err) {
    logger.error("profile.cv_extract_failed", {
      userId: user.id,
      error: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false, message: "Couldn't parse that file. Try a different export of your CV." };
  }
}

export type UpdateProfileInput = {
  fullName: string;
  targetRole: string;
  location: string;
  experienceLevel: string;
  careerGoal: string;
  linkedInUrl: string;
  linkedInText: string;
  resumeText: string;
};

export async function updateProfileAction(input: UpdateProfileInput): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!input.fullName.trim() || !input.targetRole.trim()) {
    return { ok: false, message: "Name and target role are required." };
  }

  try {
    const db = getDatabase();
    await createProfilesRepository(db).upsertForUser(user.id, {
      fullName: input.fullName.trim(),
      email: user.email ?? "",
      onboardingCompleted: true,
    });
    await createCareerProfilesRepository(db).updateLatestForUser(user.id, {
      targetRole: input.targetRole.trim(),
      location: input.location.trim() || null,
      experienceLevel: input.experienceLevel.trim() || null,
      careerGoal: input.careerGoal.trim(),
    });

    // LinkedIn URL + context and resume text are the richest AI inputs — keep
    // them editable here too. Only touch them when the user provided something,
    // so saving the basic fields never wipes an existing import.
    const linkedInUrl = input.linkedInUrl.trim();
    const linkedInText = input.linkedInText.trim();
    if (linkedInUrl || linkedInText) {
      await createLinkedInProfilesRepository(db).upsertLatestForUser(user.id, {
        profileUrl: linkedInUrl || null,
        rawText: linkedInText || null,
      });
    }

    const resumeText = input.resumeText.trim();
    if (resumeText) {
      await createResumesRepository(db).upsertLatestForUser(user.id, resumeText);
    }

    revalidatePath("/dashboard/profile");
    revalidatePath("/dashboard");
    return { ok: true, message: "Profile updated." };
  } catch (error) {
    logger.error("profile.update_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't save your profile. Please try again." };
  }
}

/**
 * Delete all of the user's career data (profile, reports, jobs, momentum, AI
 * settings — everything cascades from the domain user row) and sign out.
 */
export async function deleteAccountDataAction(): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    await createUsersRepository(getDatabase()).deleteById(user.id);
    logger.info("profile.account_data_deleted", { userId: user.id });
  } catch (error) {
    logger.error("profile.delete_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't delete your data. Please try again." };
  }

  // signOutAction redirects, ending the session.
  await signOutAction();
  return { ok: true, message: "Your data has been deleted." };
}
