import "server-only";

import { createDocumentsRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import {
  HUMANIZE_CORE,
  HUMANIZE_PROSE,
  HUMANIZE_RESUME,
  stripAiTells,
} from "@/lib/documents/humanize";
import { buildCareerContext } from "@/lib/career/context";
import { resumeFromCareerRecords } from "@/lib/career/resume-from-records";
import { truthCheck, type TruthFinding } from "@/lib/documents/truth-gate";
import { pivotFraming } from "@/lib/career/pivot";

/** Thrown when there's no career history to ground a document — callers show the
 *  honest fix ("add your history first") instead of shipping generic slop. */
export class NoHistoryError extends Error {
  constructor() {
    super(
      "No selected career records are ready. Add and review your history in Evidence, then choose what to include in this direction or application."
    );
    this.name = "NoHistoryError";
  }
}
import { isProseKind, letterFromText, serializeLetter } from "@/lib/documents/letter";
import { serializeResume, type ResumeData } from "@/lib/documents/resume";
import { resumeGenerationSchema } from "@/lib/documents/resume-schema";
import type { DocKind } from "@/lib/jobs/application-types";

export type { DocKind };

// The generation capability now lives in the AI layer (lib/ai/doc-generate) so lib/ai
// no longer imports this domain module to describe its own contract. Imported for local
// use here and re-exported for the existing callers that import it from this file.
import type { DocGenerate } from "@/lib/ai/doc-generate";
export type { DocGenerate };

const KIND_LABEL: Record<string, string> = {
  resume: "resume",
  cover_letter: "cover letter",
  email: "cold outreach email",
  value_proposition: "value proposition",
};

export type GeneratedDoc = {
  id: string;
  kind: string;
  title: string;
  /** Scope and coverage notice; accepted records are not independent verification. */
  evidenceNotice?: string;
  /** Heuristic findings, not a comprehensive factual verification. */
  truthFindings?: TruthFinding[];
};

/**
 * Draft a tailored career document grounded in the user's REAL profile/resume,
 * save it (optionally linked to a job/application), and return a pointer. Shared
 * by Fadi's generate_document tool and the per-job workspace buttons.
 */
export async function generateCareerDocument(
  userId: string,
  opts: {
    kind: DocKind;
    jobTitle?: string;
    company?: string;
    jobDescription?: string | null;
    jobId?: string | null;
    applicationId?: string | null;
    directionId?: string | null;
    /** Red-pen review fixes to incorporate (the review→redraft loop). */
    guidance?: string | null;
  },
  generate: DocGenerate
): Promise<GeneratedDoc> {
  const db = getDatabase();
  // Capture once BEFORE the model call. Direction changes or evidence edits during
  // generation cannot silently change this document's inputs or its truth-check corpus.
  const context = await buildCareerContext(
    userId,
    {
      directionId: opts.directionId,
      applicationId: opts.applicationId,
      jobId: opts.jobId,
    },
    {
      persist: true,
      target: { title: opts.jobTitle, company: opts.company, description: opts.jobDescription },
    }
  );
  const { payload } = context;
  if (!payload.records.length) throw new NoHistoryError();
  const role = payload.target.title || "the target role";
  const company = payload.target.company;
  const jobDescription = payload.target.description.slice(0, 5000).trim();
  const truthCorpus = context.block;
  const evidenceNotice = `Drafted from ${payload.records.length} selected career records. Review the wording before use; accepted records and automated checks do not establish every claim.`;
  const candidateContext = [
    `Candidate: ${payload.person.name || "the candidate"}`,
    `Target role: ${role}${company ? ` at ${company}` : ""}`,
    `Location: ${payload.direction?.location ?? "not specified"}`,
    `Career goal: ${payload.direction?.goal ?? "not specified"}`,
    jobDescription
      ? `\nTARGET JOB DESCRIPTION (tailor specifically to this — mirror its language and address its requirements with the candidate's REAL experience):\n${jobDescription}`
      : "",
    "",
    // Direction-aware framing: same shared history, framed for THIS direction —
    // adjacent-field experience adopted, transferable skills named with evidence.
    pivotFraming({
      targetRole: payload.direction?.role ?? null,
      domain: payload.direction?.domain ?? null,
      intent: payload.direction?.intent ?? null,
      careerGoal: payload.direction?.goal ?? null,
    }),
    "",
    context.block,
    opts.guidance?.trim()
      ? `\nRED-PEN REVIEW OF THE PREVIOUS DRAFT — incorporate every fix below that is grounded in the candidate's REAL experience (keep any [ADD REAL NUMBER] placeholders literally; never invent the number):\n${opts.guidance.trim().slice(0, 4000)}`
      : "",
  ].join("\n");

  const docsRepo = createDocumentsRepository(db);
  const titleSuffix = [role, company].filter(Boolean).join(" · ");
  // Tag the document with the active career track so each path owns its documents.
  const link = {
    careerProfileId: payload.directionId,
    jobId: payload.jobId,
    applicationId: payload.applicationId,
  };
  const jobContext = { jobTitle: role, company };
  const metadata = {
    careerContextSnapshotId: context.snapshotId,
    careerContextFingerprint: context.fingerprint,
    contextSchemaVersion: 1,
    provenance: payload.provenance,
  };

  if (opts.kind === "resume") {
    // EXTRACTIVE-FIRST: the anti-slop architecture. The candidate's own wording is
    // the product — AI text that reads as AI comes from REWRITING; selection and
    // reordering of their real sentences can't sound like a bot.
    const system = `You are Fadi, tailoring the candidate's selected career records to the target role${jobDescription ? " and its job description" : ""}. EXTRACTIVE-FIRST — their own wording IS the product:
- PRESERVE their sentences. Select, reorder, and trim from the base material; do NOT paraphrase bullets that already read well. Most bullets should appear verbatim or near-verbatim from the base.
- You MAY: reorder experiences and bullets by relevance to this role; drop bullets irrelevant to it; tighten a bullet by cutting filler words; surface a JD term ONLY where the underlying experience is already in the base material.
- You MAY write genuinely NEW text only for: the summary (≤45 words, grounded in the base) and the ordering/grouping of the skills list.
- If the base material is prose (a LinkedIn-style history rather than a formatted resume), structure it into resume sections while keeping the candidate's own phrases wherever they read naturally.
- Keep their real roles, companies, dates, education and projects exactly. Use only numbers already present; where a bullet begs for a metric that isn't there, keep it metric-free rather than inventing one.
CRITICAL: use ONLY real experience, education, skills and projects from the provided material. Never invent employers, dates, degrees, or achievements. If a section is thin, keep it short rather than fabricating.

${HUMANIZE_CORE}

${HUMANIZE_RESUME}`;
    const gen = await generate.structured(
      system,
      candidateContext,
      resumeGenerationSchema,
      "resume"
    );
    const personal: ResumeData["personal"] = {
      name: payload.person.name,
      headline: role,
      email: payload.person.email,
      phone: "",
      location: payload.direction?.location ?? "",
      links: "",
    };
    const content = serializeResume(resumeFromCareerRecords(payload.records, gen, personal));
    const doc = await docsRepo.createForUser(userId, {
      ...link,
      kind: "resume",
      title: `Resume — ${titleSuffix}`,
      content,
      jobContext,
      metadata,
    });
    return {
      id: doc.id,
      kind: "resume",
      title: doc.title,
      evidenceNotice,
      truthFindings: truthCheck(content, { corpus: truthCorpus, jobDescription }),
    };
  }

  const label = KIND_LABEL[opts.kind] ?? "document";
  const system = `You are Fadi, an expert career writer. Write a concise, specific, honest ${label} for the target role${jobDescription ? ", tailored to the provided job description" : ""}. Ground every claim in the candidate's REAL experience — never invent. Return plain text ready to use.

${HUMANIZE_CORE}

${HUMANIZE_PROSE}`;
  // Draft, then run the deterministic AI-tell safety net (strips any banned
  // clichés the model leaked past the prompt) before saving.
  const draft = await generate.text(system, candidateContext);
  const text = await stripAiTells(draft, (s, u) => generate.text(s, u));

  // Store prose kinds as a structured letter (Body-filled) so the draft opens
  // straight into the rich editor; other kinds (notes) stay plain text.
  const content = isProseKind(opts.kind) ? serializeLetter(letterFromText(text, opts.kind)) : text;

  const doc = await docsRepo.createForUser(userId, {
    ...link,
    kind: opts.kind,
    title: `${label.replace(/\b\w/, (c) => c.toUpperCase())} — ${titleSuffix}`,
    content,
    jobContext,
    metadata,
  });
  return {
    id: doc.id,
    kind: opts.kind,
    title: doc.title,
    evidenceNotice,
    truthFindings: truthCheck(text, { corpus: truthCorpus, jobDescription }),
  };
}
