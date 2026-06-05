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

/** Shared "write like a real person, not an AI" rules — injected into every draft. */
const HUMANIZE_GUIDE = `Write like a real, thoughtful person — not an AI. Non-negotiable:
- NO AI clichés or buzzwords: never use "leverage", "spearheaded", "passionate", "results-driven", "dynamic", "seasoned", "proven track record", "synergy", "deep dive", "fast-paced", "I am excited to", "wealth of experience", "honed".
- Vary sentence length and openings — don't start every line the same way or with "-ing" verbs. Mix short and longer sentences so it reads naturally.
- Be concrete: real tools, numbers and outcomes from the candidate's actual experience. Cut vague filler.
- Plain, confident, human voice. Active verbs. No em-dash overuse, no semicolon stacking, no emoji, no exclamation marks.
- Mirror the job description's real terminology ONLY where the candidate genuinely has that experience. Never claim a skill they don't have.`;

export type GeneratedDoc = { id: string; kind: string; title: string };

/**
 * Draft a tailored career document grounded in the user's REAL profile/resume,
 * save it (optionally linked to a job/application), and return a pointer. Shared
 * by Kai's generate_document tool and the per-job workspace buttons.
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
    const system = `You are Kai, an expert resume writer. Start from the candidate's BASE resume below and produce a version tailored to the target role${jobDescription ? " and its job description" : ""}.
- Keep their real roles, companies, dates, education and projects exactly.
- Rewrite the summary and bullets to align with what the job actually asks for: surface the most relevant real experience first, and weave in the job's real keywords/terminology WHERE the candidate genuinely has that experience.
- Show impact with the real numbers/tools already in their resume.
CRITICAL: use ONLY real experience, education, skills and projects from the provided material. Never invent employers, dates, degrees, or achievements. If a section is thin, keep it short rather than fabricating.

${HUMANIZE_GUIDE}`;
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
  const system = `You are Kai, an expert career writer. Write a concise, specific, honest ${label} for the target role${jobDescription ? ", tailored to the provided job description" : ""}. Ground every claim in the candidate's REAL experience — never invent. Return plain text ready to use.

${HUMANIZE_GUIDE}`;
  const text = await generate.text(system, candidateContext);
  const doc = await docsRepo.createForUser(userId, {
    ...link,
    kind: opts.kind,
    title: `${label.replace(/\b\w/, (c) => c.toUpperCase())} — ${titleSuffix}`,
    content: text,
    jobContext,
  });
  return { id: doc.id, kind: opts.kind, title: doc.title };
}
