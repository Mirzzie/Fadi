import type { SelectedRecord } from "./selection";
import { emptyResume, type ResumeData } from "@/lib/documents/resume";
import type { ResumeGeneration } from "@/lib/documents/resume-schema";

const same = (a: string, b: string | null) =>
  a.trim().toLocaleLowerCase() === (b ?? "").trim().toLocaleLowerCase();
/** Model prose can adapt a selected record; it cannot create, omit or rename its identity.
 * Keep-wording is enforced here, independently of whether the model follows instructions.
 * This protects structured headings, not every assertion in generated prose.
 */
export function resumeFromCareerRecords(
  records: SelectedRecord[],
  generated: ResumeGeneration,
  personal: ResumeData["personal"]
): ResumeData {
  const result = emptyResume();
  result.personal = personal;
  result.summary = generated.summary;
  for (const r of records) {
    const description = [r.detail, r.metrics].filter(Boolean).join("\n");
    switch (r.kind) {
      case "experience": {
        const wording = generated.experiences.find(
          (e) =>
            same(e.title, r.title) && same(e.company, r.organization) && same(e.period, r.period)
        );
        result.experiences.push({
          id: r.factId,
          title: r.title,
          company: r.organization ?? "",
          period: r.period ?? "",
          location: "",
          bullets:
            !r.keepWording && wording?.bullets.length ? wording.bullets.join("\n") : description,
        });
        break;
      }
      case "project": {
        const wording = generated.projects.find((p) => same(p.title, r.title));
        result.projects.push({
          id: r.factId,
          title: r.title,
          url: "",
          description:
            !r.keepWording && wording?.description.trim() ? wording.description : description,
        });
        break;
      }
      case "education":
        result.education.push({
          id: r.factId,
          degree: r.title,
          school: r.organization ?? "",
          period: r.period ?? "",
          location: "",
        });
        break;
      case "certification":
        result.certifications.push({
          id: r.factId,
          name: r.title,
          issuer: r.organization ?? "",
          date: r.period ?? "",
        });
        break;
      case "achievement":
        // An achievement is not necessarily an award. Preserve it as a highlights project.
        result.projects.push({ id: r.factId, title: r.title, url: "", description });
        break;
    }
  }
  result.skills = [
    ...new Set(records.flatMap((r) => (r.kind === "skill" ? [r.title, ...r.tags] : r.tags))),
  ].join(", ");
  return result;
}
