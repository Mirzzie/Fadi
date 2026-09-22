import { z } from "zod";

import { HUMANIZE_CORE, HUMANIZE_PROSE, HUMANIZE_RESUME } from "@/lib/documents/humanize";
import { parseResume, serializeResume } from "@/lib/documents/resume";
import { resumeImportSchema, toResumeData } from "@/lib/documents/resume-schema";
import type { BackedRecords } from "@/lib/documents/backed-records";
import { explicitRemovals, restoreDropped } from "@/lib/documents/revision-guard";

/**
 * THE REWRITE ITSELF, kept out of the server-action file.
 *
 * Every export of a "use server" module becomes a callable endpoint, so the rewrite could not be
 * exported for testing from there - and Codex's S2-R2 asked, rightly, for the real path under a
 * stubbed model rather than only the wording of its notes.
 */
export type Rewrite = {
  content: string;
  restored: string[];
  invented: string[];
  added: string[];
  removed: string[];
};

export async function rewriteResume(
  generate: { structured: <T>(system: string, user: string, schema: z.ZodType<T>, name: string) => Promise<T> },
  current: string,
  ground: string,
  scope: { instruction: string; backed: BackedRecords }
): Promise<Rewrite> {
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
        experiences: data.experiences.map((e) => ({
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
  const currentExperiences = data.experiences.map((e) => ({
    ...e,
    bullets: e.bullets.split("\n").filter(Boolean),
  }));
  const experiences = restoreDropped(currentExperiences, revised.experiences, ["company", "title"], {
    backed: scope.backed.experiences,
    removable: explicitRemovals(scope.instruction, currentExperiences, ["company", "title"]),
  });
  const education = restoreDropped(data.education, revised.education, ["school", "degree"], {
    backed: scope.backed.education,
    removable: explicitRemovals(scope.instruction, data.education, ["school", "degree"]),
  });
  const projects = restoreDropped(data.projects, revised.projects, ["title"], {
    backed: scope.backed.projects,
    removable: explicitRemovals(scope.instruction, data.projects, ["title"]),
  });

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

  // EVERY SECTION THE REWRITE DOES NOT TOUCH SURVIVES IT. Codex's S2-R3: toResumeData is the
  // IMPORT path, and an import starts from nothing — certifications, languages, awards,
  // volunteering, references, interests and publications all come back empty. A résumé that had
  // just gained the certification stage 2 works to keep could lose it on its first "Change it".
  // Starting from what the person has, and overwriting only the parts the revision covers, means
  // a section added to the document later is preserved by default rather than by memory.
  const merged = {
    ...data,
    personal: next.personal,
    summary: next.summary,
    experiences: next.experiences,
    education: next.education,
    projects: next.projects,
    skills: next.skills,
    order: data.order,
  };
  return {
    content: serializeResume(merged),
    restored: [...experiences.restored, ...education.restored, ...projects.restored],
    invented: [...experiences.invented, ...education.invented, ...projects.invented],
    added: [...experiences.added, ...education.added, ...projects.added],
    removed: [...experiences.removed, ...education.removed, ...projects.removed],
  };
}

/** A letter or email is prose: the model returns the text, and nothing else. */
export async function rewriteProse(
  generate: { text: (system: string, user: string) => Promise<string> },
  current: string,
  ground: string,
  kind: string
): Promise<Rewrite> {
  const system = `You revise ONE ${kind.replace(/_/g, " ")} to a person's instruction. Return ONLY the revised text — no preamble, no explanation, no markdown fences.
${HUMANIZE_CORE}
${HUMANIZE_PROSE}
Rules that override the instruction:
- Every claim must be supported by their record. Never add an employer, a number or an achievement that is not in it.
- Keep their voice. Revise what the instruction targets and leave the rest alone.`;
  const out = await generate.text(system, `${ground}\n\nTHE DOCUMENT NOW:\n${current.slice(0, 9000)}`);
  return {
    content: out.replace(/^```[a-z]*\n?|\n?```$/g, "").trim(),
    restored: [],
    invented: [],
    added: [],
    removed: [],
  };
}
