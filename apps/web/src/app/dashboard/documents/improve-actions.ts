"use server";

import { z } from "zod";

import { createDocumentsRepository, createJobsRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { loadCandidateCorpus } from "@/lib/documents/corpus";
import { resolveLocaleNorm } from "@/lib/documents/locale-norms";
import { truthCheck, type TruthFinding } from "@/lib/documents/truth-gate";
import { figuresAskedButNotWritten } from "@/lib/documents/improve-figures";
import { backedRecords, NO_BACKED_RECORDS } from "@/lib/documents/backed-records";
import { rewriteProse, rewriteResume } from "@/lib/documents/rewrite";
import {
  addedNote,
  inventedNote,
  removedNote,
  restoredNote,
} from "@/lib/documents/revision-guard";
import { logger } from "@/lib/observability/logger";

/**
 * TELL FADI WHAT TO CHANGE, AND IT CHANGES IT.
 *
 * Fadi could review a document, score it, and list what to fix — and then the person had to make
 * every edit by hand. Asking for "stronger bullets" produced advice about bullets. The owner's
 * words: "when I ask something to Fadi to change to the resume or any other document, Fadi
 * directly edits or modifies it accordingly."
 *
 * So this returns the REWRITTEN document, not a critique. Three things keep it honest:
 *
 *   1. It rewrites what is on the screen, using the person's REAL record as the only source of
 *      facts. The instruction can change emphasis, order, wording and length — never history.
 *   2. The result goes through the same truth gate as everything else, BEFORE it reaches the
 *      editor. A rewrite that invents a number the record cannot support is refused outright,
 *      with the offending figure named — a tailored lie is worse than a weak bullet.
 *   3. Nothing is saved here. The editor applies it, autosaves a new version, and the document's
 *      history keeps the previous one, so a change can always be undone.
 */

const instruction = z.string().trim().min(2).max(500);

export type ImproveResult =
  | { ok: true; content: string; note: string; warnings: string[] }
  | { ok: false; message: string; blocked?: TruthFinding[] };

export async function improveDocumentAction(input: {
  documentId: string;
  /** What is in the editor right now — not what was last saved. */
  currentContent: string;
  instruction: string;
}): Promise<ImproveResult> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.documentId);
  const ask = instruction.safeParse(input.instruction);
  if (!id.success) return { ok: false, message: "Unknown document." };
  if (!ask.success) return { ok: false, message: "Say what you'd like changed." };
  if (!input.currentContent.trim()) return { ok: false, message: "There's nothing to change yet." };

  const db = getDatabase();
  const doc = await createDocumentsRepository(db).getForUser(user.id, id.data);
  if (!doc) return { ok: false, message: "That document is unavailable." };

  const job = doc.jobId ? await createJobsRepository(db).findByIdForUser(user.id, doc.jobId) : null;
  const generate = await getUserDocGenerate(user.id);
  if (!generate) {
    return { ok: false, message: "Rewriting needs an AI provider — add one in Settings → AI." };
  }

  const corpus = await loadCandidateCorpus(user.id);
  const before = truthCheck(input.currentContent, {
    corpus,
    jobDescription: job?.description ?? null,
  });
  const standard = resolveLocaleNorm(job?.location ?? null);

  const ground = [
    `THE PERSON'S REAL RECORD — the only source of facts. Never state anything it does not support:\n${corpus.slice(0, 9000)}`,
    job?.description
      ? `THE POSTING they are applying to — tailor emphasis and wording to it:\n${job.title} at ${job.company}\n${job.description.slice(0, 5000)}`
      : "",
    `LOCAL NORMS (${standard.label}): ${standard.documentTerm}, ${standard.lengthPages} pages, photo ${standard.photo}, dates ${standard.dateFormat}. ${standard.notes}`,
    `WHAT THEY ASKED FOR: ${ask.data}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // What their record supports, so a rewrite can work in their own project without the guard
  // mistaking it for an invention (S2-R2). Their whole accepted record, not this document's
  // selection: asking to add something is exactly how a record enters a document.
  let backed = NO_BACKED_RECORDS;
  try {
    const { buildCareerContext } = await import("@/lib/career/context");
    backed = backedRecords((await buildCareerContext(user.id, { all: true })).payload.records);
  } catch {
    // Unreadable record: the guard falls back to allowing nothing new, which is the safe side.
  }

  const rewrite = (extra: string) =>
    doc.kind === "resume"
      ? rewriteResume(generate, input.currentContent, ground + extra, {
          instruction: ask.data,
          backed,
        })
      : rewriteProse(generate, input.currentContent, ground + extra, doc.kind);

  const newFigures = (text: string) =>
    truthCheck(text, { corpus, jobDescription: job?.description ?? null }).filter(
      (f) => f.severity === "block" && !before.some((b) => b.offending === f.offending)
    );

  try {
    let revision = await rewrite("");
    let content = revision.content;
    if (!content.trim()) return { ok: false, message: "Fadi couldn't produce a revision. Try asking differently." };

    // THE GATE RUNS BEFORE THE PERSON SEES IT. A rewrite that adds an unsupported figure is
    // refused, not offered with a warning: the point of asking Fadi to tailor is that they
    // trust the result.
    //
    // ONE REPAIR FIRST, though. Measured on a real résumé: asked to "lead with the Linux work",
    // the model reached for "15%" — a figure from an older draft that the record does not carry —
    // and the person got a refusal for something they never asked for. Naming the offending
    // figures and asking again fixes it without their involvement; a second failure is theirs to
    // know about.
    let newBlocking = newFigures(content);
    if (newBlocking.length > 0) {
      const named = newBlocking.map((f) => f.offending).join(", ");
      const repaired = await rewrite(
        `\n\nYOUR PREVIOUS ATTEMPT introduced ${named}, which their record does not support. Write it again with NO figure that does not appear verbatim in their record. Describe the work without a number instead.`
      );
      if (repaired.content.trim()) {
        const stillBad = newFigures(repaired.content);
        if (stillBad.length < newBlocking.length) {
          revision = repaired;
          content = repaired.content;
          newBlocking = stillBad;
        }
      }
    }

    const after = truthCheck(content, { corpus, jobDescription: job?.description ?? null });
    if (newBlocking.length > 0) {
      logger.warn("documents.improve_refused", { userId: user.id, documentId: doc.id });
      return {
        ok: false,
        blocked: newBlocking,
        message: `That rewrite added ${newBlocking.length === 1 ? "a figure" : "figures"} your record doesn't support, so Fadi hasn't applied it. Add the evidence first, or ask for the change without new numbers.`,
      };
    }

    // SAY WHAT WAS NOT DONE. Asked to "add that I cut cloud costs by 47%", the model correctly
    // refused to write a figure the record cannot support — and Fadi then reported a plain
    // "Rewritten", leaving the person to assume their number was in the document. Silence about a
    // refusal is its own dishonesty.
    const declined = figuresAskedButNotWritten(ask.data, corpus, content);
    logger.info("documents.improved", { userId: user.id, documentId: doc.id, kind: doc.kind, declined: declined.length });
    return {
      ok: true,
      content,
      note: [
        job
          ? `Rewritten for ${job.title} at ${job.company}, using only what your record supports.`
          : "Rewritten using only what your record supports.",
        declined.length > 0
          ? `Fadi did not add ${declined.join(" or ")} — your record doesn't show ${declined.length === 1 ? "it" : "them"}. Record the evidence first and ask again.`
          : "",
        addedNote(revision.added),
        removedNote(revision.removed),
        restoredNote(revision.restored),
        inventedNote(revision.invented),
      ]
        .filter(Boolean)
        .join(" "),
      // Warnings that already existed stay visible — the rewrite did not introduce them, and
      // they are still worth fixing.
      warnings: after
        .filter((f) => f.severity === "warn")
        .slice(0, 6)
        .map((f) => f.message),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.warn("documents.improve_failed", { userId: user.id, detail });
    if (/\b429\b|rate.?limit/i.test(detail)) {
      return { ok: false, message: "Your AI provider is rate-limiting. Wait a minute and try again." };
    }
    return { ok: false, message: "Fadi couldn't rewrite it just now. Nothing was changed." };
  }
}

/** A résumé is structured: the model edits the structure, so sections and order survive. */
