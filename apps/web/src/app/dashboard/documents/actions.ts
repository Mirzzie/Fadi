"use server";

import { revalidatePath } from "next/cache";

import { createDocumentsRepository, type DocumentKind } from "@careeros/database";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";

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
