import "server-only";

import type { ZodSchema } from "zod";

import {
  createCareerProfilesRepository,
  createDocumentsRepository,
  createLinkedInProfilesRepository,
  createProfilesRepository,
  createResumesRepository,
} from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import {
  HUMANIZE_CORE,
  HUMANIZE_PROSE,
  HUMANIZE_RESUME,
  stripAiTells,
} from "@/lib/documents/humanize";
import { composeCareerEvidence, isResumeJustLinkedInCopy } from "@/lib/career/evidence";
import { pivotFraming } from "@/lib/career/pivot";

/** Thrown when there's no career history to ground a document — callers show the
 *  honest fix ("add your history first") instead of shipping generic slop. */
export class NoHistoryError extends Error {
  constructor() {
    super(
      "I don't have your career history yet, and drafting without it would just be generic filler. Paste your LinkedIn history (or your resume) in Profile first — then everything I write is grounded in you.",
    );
    this.name = "NoHistoryError";
  }
}
import { isProseKind, letterFromText, serializeLetter } from "@/lib/documents/letter";
import { serializeResume, type ResumeData } from "@/lib/documents/resume";
import { resumeGenerationSchema, toResumeData } from "@/lib/documents/resume-schema";
import type { DocKind } from "@/lib/jobs/application-types";

export type { DocKind };

/** The model-generation capability, bound to the user's provider by the caller. */
export interface DocGenerate {
  structured<T>(system: string, user: string, schema: ZodSchema<T>, name: string): Promise<T>;
  text(system: string, user: string): Promise<string>;
}

const KIND_LABEL: Record<string, string> = {
  resume: "resume",
  cover_letter: "cover letter",
  email: "cold outreach email",
  value_proposition: "value proposition",
};

export type GeneratedDoc = { id: string; kind: string; title: string };

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
    /** Red-pen review fixes to incorporate (the review→redraft loop). */
    guidance?: string | null;
  },
  generate: DocGenerate,
): Promise<GeneratedDoc> {
  const db = getDatabase();
  const careerProfile = await createCareerProfilesRepository(db).getActiveForUser(userId);
  const resumesRepo = createResumesRepository(db);
  const [profile, trackResume, linkedin] = await Promise.all([
    createProfilesRepository(db).getByUserId(userId),
    // Tailor from THIS direction's resume (falls back to the shared one).
    resumesRepo.getLatestForTrack(userId, careerProfile?.id ?? null),
    createLinkedInProfilesRepository(db).getLatestForUser(userId),
  ]);

  // Real failure mode (seen in the wild): a track's resume slot holds a COPY of
  // the LinkedIn paste instead of an actual CV — generation then has no real
  // resume voice/structure to preserve and invents wording wholesale (AI slop).
  // Detect the copy and fall back to the shared base resume (the real CV).
  let resume = trackResume;
  const linkedInText = linkedin?.rawText ?? linkedin?.profileUrl;
  if (
    careerProfile &&
    resume?.careerProfileId &&
    isResumeJustLinkedInCopy(resume.parsedText ?? resume.rawText, linkedInText)
  ) {
    const shared = await resumesRepo.getLatestForTrack(userId, null);
    if (shared && !isResumeJustLinkedInCopy(shared.parsedText ?? shared.rawText, linkedInText)) {
      resume = shared;
    }
  }

  const role = opts.jobTitle?.trim() || careerProfile?.targetRole || "the target role";
  const company = opts.company?.trim() ?? "";
  // LinkedIn (when provided) is the full record / source of truth; the resume is a
  // role-tailored excerpt. composeCareerEvidence enforces that hierarchy + labels.
  const evidence = composeCareerEvidence({
    resumeText: resume?.parsedText ?? resume?.rawText,
    linkedInText,
  });

  // No history at all → refuse honestly. Generating a "resume" from nothing but a
  // role name is guaranteed generic slop, and slop is worse than a clear ask.
  if (evidence.historySource === "none") {
    throw new NoHistoryError();
  }

  // The shared evidence pool, ranked for the ACTIVE track — so the same history
  // produces a differently-framed document per direction (the multi-track payoff).
  const topEvidence = await import("@/lib/evidence/pool").then((m) => m.topEvidenceForPrompt(userId));

  const jobDescription = (opts.jobDescription ?? "").slice(0, 5000).trim();
  const candidateContext = [
    `Candidate: ${profile?.fullName ?? "the candidate"}`,
    `Target role: ${role}${company ? ` at ${company}` : ""}`,
    `Location: ${careerProfile?.location ?? "not specified"}`,
    `Career goal: ${careerProfile?.careerGoal ?? "not specified"}`,
    jobDescription
      ? `\nTARGET JOB DESCRIPTION (tailor specifically to this — mirror its language and address its requirements with the candidate's REAL experience):\n${jobDescription}`
      : "",
    "",
    // Direction-aware framing: same shared history, framed for THIS direction —
    // adjacent-field experience adopted, transferable skills named with evidence.
    pivotFraming({
      targetRole: careerProfile?.targetRole ?? null,
      domain: careerProfile?.domain ?? null,
      intent: careerProfile?.intent ?? null,
      careerGoal: careerProfile?.careerGoal ?? null,
    }),
    "",
    evidence.block,
    topEvidence ? `\n${topEvidence}` : "",
    opts.guidance?.trim()
      ? `\nRED-PEN REVIEW OF THE PREVIOUS DRAFT — incorporate every fix below that is grounded in the candidate's REAL experience (keep any [ADD REAL NUMBER] placeholders literally; never invent the number):\n${opts.guidance.trim().slice(0, 4000)}`
      : "",
  ].join("\n");

  const docsRepo = createDocumentsRepository(db);
  const titleSuffix = [role, company].filter(Boolean).join(" · ");
  // Tag the document with the active career track so each path owns its documents.
  const link = {
    careerProfileId: careerProfile?.id ?? null,
    jobId: opts.jobId ?? null,
    applicationId: opts.applicationId ?? null,
  };
  const jobContext = { jobTitle: role, company };

  if (opts.kind === "resume") {
    // EXTRACTIVE-FIRST: the anti-slop architecture. The candidate's own wording is
    // the product — AI text that reads as AI comes from REWRITING; selection and
    // reordering of their real sentences can't sound like a bot.
    const system = `You are Fadi, tailoring the candidate's BASE resume to the target role${jobDescription ? " and its job description" : ""}. EXTRACTIVE-FIRST — their own wording IS the product:
- PRESERVE their sentences. Select, reorder, and trim from the base material; do NOT paraphrase bullets that already read well. Most bullets should appear verbatim or near-verbatim from the base.
- You MAY: reorder experiences and bullets by relevance to this role; drop bullets irrelevant to it; tighten a bullet by cutting filler words; surface a JD term ONLY where the underlying experience is already in the base material.
- You MAY write genuinely NEW text only for: the summary (≤45 words, grounded in the base) and the ordering/grouping of the skills list.
- If the base material is prose (a LinkedIn-style history rather than a formatted resume), structure it into resume sections while keeping the candidate's own phrases wherever they read naturally.
- Keep their real roles, companies, dates, education and projects exactly. Use only numbers already present; where a bullet begs for a metric that isn't there, keep it metric-free rather than inventing one.
CRITICAL: use ONLY real experience, education, skills and projects from the provided material. Never invent employers, dates, degrees, or achievements. If a section is thin, keep it short rather than fabricating.

${HUMANIZE_CORE}

${HUMANIZE_RESUME}`;
    const gen = await generate.structured(system, candidateContext, resumeGenerationSchema, "resume");
    const personal: ResumeData["personal"] = {
      name: profile?.fullName ?? "",
      headline: role,
      email: profile?.email ?? "",
      phone: "",
      location: careerProfile?.location ?? "",
      links: linkedin?.profileUrl ?? "",
    };
    const doc = await docsRepo.createForUser(userId, {
      ...link,
      kind: "resume",
      title: `Resume — ${titleSuffix}`,
      content: serializeResume(toResumeData(gen, personal)),
      jobContext,
    });
    return { id: doc.id, kind: "resume", title: doc.title };
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
  const content = isProseKind(opts.kind)
    ? serializeLetter(letterFromText(text, opts.kind))
    : text;

  const doc = await docsRepo.createForUser(userId, {
    ...link,
    kind: opts.kind,
    title: `${label.replace(/\b\w/, (c) => c.toUpperCase())} — ${titleSuffix}`,
    content,
    jobContext,
  });
  return { id: doc.id, kind: opts.kind, title: doc.title };
}
