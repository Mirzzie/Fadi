import "server-only";

import type { DocGenerate } from "@/lib/ai/doc-generate";
import { importedToResumeData, resumeImportSchema } from "@/lib/documents/resume-schema";
import { parseResume, serializeResume, type ResumeData } from "@/lib/documents/resume";

/**
 * Turn the raw text extracted from an uploaded CV into our structured ResumeData
 * using the user's AI provider — VERBATIM, never inventing. This is parsing, not
 * tailoring: we keep their real roles, dates, bullets and contact details.
 */
const SYSTEM = `You are parsing an existing résumé/CV into structured fields. Extract the content VERBATIM — do NOT invent, embellish, rewrite, or tailor anything. Use the person's real name, contact details, roles, companies, dates, bullet points, education and skills exactly as written in the document. If a field isn't present, leave it as an empty string or empty array. Map each "Category: skill, skill" grouping if present, otherwise list skills plainly. Return only the structured data.`;

export async function structureResumeText(text: string, generate: DocGenerate): Promise<ResumeData> {
  const parsed = await generate.structured(
    SYSTEM,
    text.slice(0, 12000),
    resumeImportSchema,
    "resume_import",
  );
  return importedToResumeData(parsed);
}

/**
 * Fallback when no AI provider is available: keep the user's text rather than
 * trapping them — drop it into the resume summary so nothing is lost and they
 * can edit it into shape. (parseResume puts legacy plain text into `summary`.)
 */
export function rawTextToResumeContent(text: string): string {
  return serializeResume(parseResume(text));
}
