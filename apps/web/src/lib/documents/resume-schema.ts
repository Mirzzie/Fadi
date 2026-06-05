import { z } from "zod";

import { DEFAULT_SECTION_ORDER, newId, type ResumeData } from "./resume";

/**
 * The shape Kai generates for a tailored resume. No `id`s (we add them) and
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
