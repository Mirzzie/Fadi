/**
 * Structured resume model. A resume document stores this as JSON in
 * `documents.content` so the form editor and live preview share one shape, and
 * Kai can later generate straight into it (Phase 3) or export it (Phase 4).
 */

export type ResumeExperience = {
  id: string;
  title: string;
  company: string;
  location: string;
  period: string;
  bullets: string; // one achievement per line
};

export type ResumeEducation = {
  id: string;
  degree: string;
  school: string;
  location: string;
  period: string;
};

export type ResumeProject = {
  id: string;
  title: string;
  url: string;
  description: string;
};

export type ResumeTemplate = "classic" | "modern" | "compact";
export const RESUME_TEMPLATES: { id: ResumeTemplate; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "modern", label: "Modern" },
  { id: "compact", label: "Compact" },
];

/** The canonical render order of resume sections (reorderable in the editor). */
export type ResumeSectionKey = "summary" | "experiences" | "projects" | "education" | "skills";
export const DEFAULT_SECTION_ORDER: ResumeSectionKey[] = [
  "summary",
  "experiences",
  "projects",
  "education",
  "skills",
];

export type ResumeData = {
  personal: {
    name: string;
    headline: string;
    email: string;
    phone: string;
    location: string;
    links: string; // "LinkedIn · GitHub · Portfolio" freeform
  };
  summary: string;
  experiences: ResumeExperience[];
  education: ResumeEducation[];
  skills: string; // one "Category: a, b, c" per line
  projects: ResumeProject[];
  /** Section render order — reorderable in the editor. */
  order: ResumeSectionKey[];
};

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyResume(): ResumeData {
  return {
    personal: { name: "", headline: "", email: "", phone: "", location: "", links: "" },
    summary: "",
    experiences: [],
    education: [],
    skills: "",
    projects: [],
    order: [...DEFAULT_SECTION_ORDER],
  };
}

/** Sanitize/complete a section order — keep known keys, append any missing. */
function normalizeOrder(order: unknown): ResumeSectionKey[] {
  const valid = Array.isArray(order)
    ? (order.filter((k) => (DEFAULT_SECTION_ORDER as string[]).includes(k)) as ResumeSectionKey[])
    : [];
  const seen = new Set(valid);
  return [...valid, ...DEFAULT_SECTION_ORDER.filter((k) => !seen.has(k))];
}

/** Parse a document's content into ResumeData; tolerant of empty/legacy plain text. */
export function parseResume(content: string): ResumeData {
  const base = emptyResume();
  if (!content?.trim()) return base;
  try {
    const parsed = JSON.parse(content) as Partial<ResumeData>;
    return {
      personal: { ...base.personal, ...(parsed.personal ?? {}) },
      summary: parsed.summary ?? "",
      experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
      skills: parsed.skills ?? "",
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      order: normalizeOrder((parsed as { order?: unknown }).order),
    };
  } catch {
    // Legacy plain-text resume → drop it into the summary so nothing is lost.
    return { ...base, summary: content };
  }
}

export function serializeResume(data: ResumeData): string {
  return JSON.stringify(data);
}
