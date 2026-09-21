"use server";

import { z } from "zod";

import { createDocumentsRepository, createJobsRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { loadCandidateCorpus } from "@/lib/documents/corpus";
import { HUMANIZE_CORE, HUMANIZE_PROSE, HUMANIZE_RESUME } from "@/lib/documents/humanize";
import { resolveLocaleNorm } from "@/lib/documents/locale-norms";
import { parseResume, serializeResume } from "@/lib/documents/resume";
import { resumeImportSchema, toResumeData } from "@/lib/documents/resume-schema";
import { truthCheck, type TruthFinding } from "@/lib/documents/truth-gate";
import { figuresAskedButNotWritten } from "@/lib/documents/improve-figures";
import { inventedNote, restoreDropped, restoredNote } from "@/lib/documents/revision-guard";
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

  const rewrite = (extra: string) =>
    doc.kind === "resume"
      ? rewriteResume(generate, input.currentContent, ground + extra)
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
async function rewriteResume(
  generate: { structured: <T>(system: string, user: string, schema: z.ZodType<T>, name: string) => Promise<T> },
  current: string,
  ground: string
): Promise<{ content: string; restored: string[]; invented: string[] }> {
  const data = parseResume(current);
  const system = `You revise ONE résumé to a person's instruction. Return the whole résumé, revised.
${HUMANIZE_CORE}
${HUMANIZE_RESUME}
Rules that override the instruction:
- Every claim must be supported by their record. Do not add employers, dates, tools, certifications or numbers that are not in it.
- Keep their own wording where it already works; rewrite what the instruction targets.
- Bullets: concrete action, the thing itself, and the outcome where the record gives one. No invented metrics.
- Keep every section they have unless the instruction says to remove it.`;

  const revised = await generate.structured(
    system,
    `${ground}\n\nTHE RÉSUMÉ NOW (JSON):\n${JSON.stringify(
      {
        personal: data.personal,
        summary: data.summary,
        experiences: data.experiences.map((e: { bullets: string }) => ({
          ...e,
          bullets: e.bullets.split("\n").filter(Boolean),
        })),
        education: data.education,
        skills: data.skills,
        projects: data.projects,
      },
      null,
      1
    ).slice(0, 12000)}`,
    resumeImportSchema,
    "resume_revision"
  );

  // NOTHING IS DELETED BY A REWRITE. A model that omits an employer returns a perfectly valid
  // résumé, so this is checked structurally rather than asked for in the prompt.
  const experiences = restoreDropped(
    data.experiences.map((e) => ({ ...e, bullets: e.bullets.split("\n").filter(Boolean) })),
    revised.experiences,
    ["company", "title"]
  );
  const education = restoreDropped(data.education, revised.education, ["school", "degree"]);
  const projects = restoreDropped(data.projects, revised.projects, ["title"]);

  // Rebuild through the same path an import uses, then keep the section order the person chose.
  const next = toResumeData(
    {
      summary: revised.summary,
      experiences: experiences.entries,
      education: education.entries,
      skills: revised.skills,
      projects: projects.entries,
    },
    revised.personal
  );
  return {
    content: serializeResume({ ...next, order: data.order }),
    restored: [...experiences.restored, ...education.restored, ...projects.restored],
    invented: [...experiences.invented, ...education.invented, ...projects.invented],
  };
}

/** A letter or email is prose: the model returns the text, and nothing else. */
async function rewriteProse(
  generate: { text: (system: string, user: string) => Promise<string> },
  current: string,
  ground: string,
  kind: string
): Promise<{ content: string; restored: string[]; invented: string[] }> {
  const system = `You revise ONE ${kind.replace(/_/g, " ")} to a person's instruction. Return ONLY the revised text — no preamble, no explanation, no markdown fences.
${HUMANIZE_CORE}
${HUMANIZE_PROSE}
Rules that override the instruction:
- Every claim must be supported by their record. Never add an employer, a number or an achievement that is not in it.
- Keep their voice. Revise what the instruction targets and leave the rest alone.`;
  const out = await generate.text(system, `${ground}\n\nTHE DOCUMENT NOW:\n${current.slice(0, 9000)}`);
  return { content: out.replace(/^```[a-z]*\n?|\n?```$/g, "").trim(), restored: [], invented: [] };
}
