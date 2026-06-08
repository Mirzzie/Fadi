"use server";

import { revalidatePath } from "next/cache";

import { createDocumentsRepository, type DocumentKind } from "@careeros/database";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { getDatabase } from "@/lib/database/client";
import { extractDocumentText, detectDocType } from "@/lib/documents/extract-text";
import { rawTextToResumeContent, structureResumeText } from "@/lib/documents/import-resume";
import { fromJsonResume, parseJsonResume } from "@/lib/documents/json-resume";
import { serializeResume } from "@/lib/documents/resume";
import { logger } from "@/lib/observability/logger";

const MAX_IMPORT_BYTES = 8 * 1024 * 1024; // 8 MB — resumes are small

type Result = { ok: boolean; message: string; id?: string };

const DEFAULT_TITLES: Record<string, string> = {
  resume: "Untitled resume",
  cover_letter: "Untitled cover letter",
  email: "Untitled email",
  value_proposition: "Untitled value proposition",
  note: "Untitled note",
};

export async function createDocumentAction(input: {
  kind: DocumentKind;
  title?: string;
  jobId?: string | null;
}): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    const doc = await createDocumentsRepository(getDatabase()).createForUser(user.id, {
      kind: input.kind,
      title: input.title?.trim() || DEFAULT_TITLES[input.kind] || "Untitled document",
      jobId: input.jobId ?? null,
    });
    revalidatePath("/dashboard/documents");
    return { ok: true, message: "Document created.", id: doc.id };
  } catch (error) {
    logger.error("documents.create_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't create the document." };
  }
}

/**
 * Import a JSON Resume (jsonresume.org) file → a new editable resume document.
 * Lets users bring resume data from any JSON-Resume-compatible tool into Kai.
 */
export async function importJsonResumeAction(jsonText: string, title?: string): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  let content: string;
  let resolvedTitle: string;
  try {
    const jr = parseJsonResume(jsonText);
    const data = fromJsonResume(jr);
    content = serializeResume(data);
    resolvedTitle = title?.trim() || (data.personal.name ? `${data.personal.name} — Resume` : "Imported resume");
  } catch {
    return { ok: false, message: "That doesn't look like a valid JSON Resume file." };
  }

  try {
    const doc = await createDocumentsRepository(getDatabase()).createForUser(user.id, {
      kind: "resume",
      title: resolvedTitle,
      content,
      format: "richtext",
    });
    revalidatePath("/dashboard/documents");
    return { ok: true, message: "Resume imported.", id: doc.id };
  } catch (error) {
    logger.error("documents.import_json_resume_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't import that resume." };
  }
}

/**
 * Import a CV/résumé from the formats people actually have — PDF, DOCX, legacy
 * DOC, TXT, or a JSON Resume file → a new editable resume document. Extracts the
 * text, then (if an AI provider is connected) structures it into fields
 * verbatim; otherwise keeps the text so nothing is lost.
 */
export async function importResumeFileAction(formData: FormData): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "No file received." };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, message: "That file is too large (max 8 MB)." };
  }

  const type = detectDocType(file.name, file.type);
  if (!type) {
    return { ok: false, message: "Unsupported file — use PDF, DOCX, DOC, TXT, or JSON Resume." };
  }

  // JSON Resume keeps its dedicated structured path.
  if (type === "json") {
    return importJsonResumeAction(await file.text());
  }

  let content: string;
  let title: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractDocumentText(buffer, file.name, file.type);
    if (text.trim().length < 30) {
      return { ok: false, message: "Couldn't read meaningful text from that file (is it a scan/image?)." };
    }

    const generate = await getUserDocGenerate(user.id);
    if (generate) {
      const data = await structureResumeText(text, generate);
      content = serializeResume(data);
      title = data.personal.name ? `${data.personal.name} — Resume` : "Imported resume";
    } else {
      // No AI provider — keep the text so the user isn't trapped; they can edit it.
      content = rawTextToResumeContent(text);
      title = file.name.replace(/\.[^.]+$/, "") || "Imported resume";
    }
  } catch (error) {
    logger.error("documents.import_file_failed", {
      userId: user.id,
      type,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't import that file. Try a different format or paste the text." };
  }

  try {
    const doc = await createDocumentsRepository(getDatabase()).createForUser(user.id, {
      kind: "resume",
      title,
      content,
      format: "richtext",
    });
    revalidatePath("/dashboard/documents");
    return { ok: true, message: "Resume imported.", id: doc.id };
  } catch (error) {
    logger.error("documents.import_file_save_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't save the imported resume." };
  }
}

export async function updateDocumentAction(input: {
  id: string;
  title?: string;
  content?: string;
  template?: string | null;
}): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    const updated = await createDocumentsRepository(getDatabase()).updateForUser(user.id, input.id, {
      ...(input.title !== undefined ? { title: input.title.trim() || "Untitled" } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.template !== undefined ? { template: input.template } : {}),
    });
    if (!updated) return { ok: false, message: "Document not found." };
    revalidatePath("/dashboard/documents");
    revalidatePath(`/dashboard/documents/${input.id}`);
    return { ok: true, message: "Saved." };
  } catch (error) {
    logger.error("documents.update_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't save the document." };
  }
}

export async function deleteDocumentAction(id: string): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    await createDocumentsRepository(getDatabase()).deleteForUser(user.id, id);
    revalidatePath("/dashboard/documents");
    return { ok: true, message: "Deleted." };
  } catch (error) {
    logger.error("documents.delete_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't delete the document." };
  }
}
