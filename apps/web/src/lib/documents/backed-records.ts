import type { Entry } from "@/lib/documents/revision-guard";

/**
 * WHAT THE PERSON'S RECORD SUPPORTS, in the shape a résumé section uses.
 *
 * The rewrite guard needs to tell two things apart that look identical in a returned document: an
 * entry the model invented, and an entry the person genuinely has but had not put on this
 * résumé yet. Only their evidence can settle it — so their accepted records are translated into
 * the same {company, title} / {school, degree} / {title} shapes the guard compares by.
 */
export type BackedRecords = {
  experiences: Entry[];
  education: Entry[];
  projects: Entry[];
};

export type RecordLike = {
  kind?: string | null;
  title?: string | null;
  organization?: string | null;
};

export const NO_BACKED_RECORDS: BackedRecords = { experiences: [], education: [], projects: [] };

/** Group accepted records by the résumé section they would appear in. */
export function backedRecords(records: RecordLike[]): BackedRecords {
  const out: BackedRecords = { experiences: [], education: [], projects: [] };
  for (const record of records) {
    const title = (record.title ?? "").trim();
    if (!title) continue;
    const organization = (record.organization ?? "").trim();
    switch ((record.kind ?? "").toLowerCase()) {
      case "experience":
        out.experiences.push({ company: organization, title });
        break;
      case "education":
        out.education.push({ school: organization, degree: title });
        break;
      case "project":
        out.projects.push({ title });
        break;
      default:
        // A certification, award or anything unclassified is not a résumé experience, education
        // or project entry. Leaving it out means the guard still treats it as an invention IN
        // THOSE SECTIONS — which is right: a certification is not a job.
        break;
    }
  }
  return out;
}
