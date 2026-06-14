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
 * by Scout's generate_document tool and the per-job workspace buttons.
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
  },
  generate: DocGenerate,
): Promise<GeneratedDoc> {
  const db = getDatabase();
  const [profile, careerProfile, resume, linkedin] = await Promise.all([
    createProfilesRepository(db).getByUserId(userId),
    createCareerProfilesRepository(db).getActiveForUser(userId),
    createResumesRepository(db).getLatestForUser(userId),
    createLinkedInProfilesRepository(db).getLatestForUser(userId),
  ]);

  const role = opts.jobTitle?.trim() || careerProfile?.targetRole || "the target role";
  const company = opts.company?.trim() ?? "";
  const resumeText = (resume?.parsedText ?? resume?.rawText ?? "").slice(0, 6000);
  const linkedinText = (linkedin?.rawText ?? "").slice(0, 2000);

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
    "Resume / experience (the ONLY source of real experience — never invent beyond this):",
    resumeText || "(no resume on file — keep the document honest and brief)",
    linkedinText ? `\nLinkedIn context:\n${linkedinText}` : "",
  ].join("\n");

  const docsRepo = createDocumentsRepository(db);
  const titleSuffix = [role, company].filter(Boolean).join(" · ");
  const link = { jobId: opts.jobId ?? null, applicationId: opts.applicationId ?? null };
  const jobContext = { jobTitle: role, company };

  if (opts.kind === "resume") {
    const system = `You are Scout, an expert resume writer. Start from the candidate's BASE resume below and produce a version tailored to the target role${jobDescription ? " and its job description" : ""}.
- Keep their real roles, companies, dates, education and projects exactly.
- Rewrite the summary and bullets to align with what the job actually asks for: surface the most relevant real experience first, and weave in the job's real keywords/terminology WHERE the candidate genuinely has that experience.
- Show impact with the real numbers/tools already in their resume.
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
  const system = `You are Scout, an expert career writer. Write a concise, specific, honest ${label} for the target role${jobDescription ? ", tailored to the provided job description" : ""}. Ground every claim in the candidate's REAL experience — never invent. Return plain text ready to use.

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
