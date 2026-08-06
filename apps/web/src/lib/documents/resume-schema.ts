import { z } from "zod";

import { DEFAULT_SECTION_ORDER, newId, type ResumeData } from "./resume";

/**
 * The shape Fadi generates for a tailored resume. No `id`s (we add them) and
 * bullets as an array (we join to the editor's newline format). Kept flat and
 * simple so smaller/free models produce valid JSON reliably.
 */
export const resumeGenerationSchema = z.object({
  summary: z.string(),
  experiences: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      location: z.string(),
      period: z.string(),
      bullets: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({
      degree: z.string(),
      school: z.string(),
      location: z.string(),
      period: z.string(),
    }),
  ),
  skills: z.array(z.string()), // each "Category: a, b, c"
  projects: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      description: z.string(),
    }),
  ),
});

export type ResumeGeneration = z.infer<typeof resumeGenerationSchema>;

/** Merge generated content with the user's real contact details into ResumeData. */
export function toResumeData(
  gen: ResumeGeneration,
  personal: ResumeData["personal"],
): ResumeData {
  return {
    personal,
    summary: gen.summary,
    certifications: [],
    languages: [],
    experiences: gen.experiences.map((e) => ({
      id: newId(),
      title: e.title,
      company: e.company,
      location: e.location,
      period: e.period,
      bullets: e.bullets.join("\n"),
    })),
    education: gen.education.map((ed) => ({ id: newId(), ...ed })),
    projects: gen.projects.map((p) => ({ id: newId(), ...p })),
    skills: gen.skills.join("\n"),
    order: [...DEFAULT_SECTION_ORDER],
  };
}

/**
 * Schema for PARSING an existing resume (from an uploaded PDF/DOCX/DOC) into our
 * structure. Unlike generation, this also captures the candidate's real contact
 * details from the document itself, and must be verbatim — never invented.
 */
export const resumeImportSchema = z.object({
  personal: z.object({
    name: z.string(),
    headline: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    links: z.string(),
  }),
  summary: z.string(),
  experiences: resumeGenerationSchema.shape.experiences,
  education: resumeGenerationSchema.shape.education,
  skills: resumeGenerationSchema.shape.skills,
  projects: resumeGenerationSchema.shape.projects,
});

export type ResumeImport = z.infer<typeof resumeImportSchema>;

/** Build ResumeData from a parsed-import payload (contact details come from the doc). */
export function importedToResumeData(parsed: ResumeImport): ResumeData {
  return toResumeData(
    {
      summary: parsed.summary,
      experiences: parsed.experiences,
      education: parsed.education,
      skills: parsed.skills,
      projects: parsed.projects,
    },
    parsed.personal,
  );
}
