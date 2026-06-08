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

export type ResumeTemplate = "classic" | "modern" | "compact" | "ats" | "executive";
export const RESUME_TEMPLATES: { id: ResumeTemplate; label: string; hint?: string }[] = [
  { id: "ats", label: "ATS", hint: "Maximum parse-safety — single column, plain, no color" },
  { id: "classic", label: "Classic", hint: "Centered, traditional" },
  { id: "modern", label: "Modern", hint: "Left-aligned with a teal accent" },
  { id: "executive", label: "Executive", hint: "Refined serif, centered" },
  { id: "compact", label: "Compact", hint: "Tighter spacing to fit more" },
];

/**
 * Recruiter- and ATS-recommended fonts (2026 guidance): Calibri/Arial pass
 * every major parser; Helvetica is a clean modern sans; Georgia/Garamond suit
 * traditional fields (finance, law). Each maps to a print/preview CSS stack and
 * a DOCX font name.
 */
export type ResumeFontId = "calibri" | "arial" | "helvetica" | "georgia" | "garamond";
export const RESUME_FONTS: {
  id: ResumeFontId;
  label: string;
  cssStack: string;
  docxName: string;
  category: "sans" | "serif";
  note?: string;
}[] = [
  { id: "calibri", label: "Calibri", cssStack: "Calibri, 'Segoe UI', system-ui, sans-serif", docxName: "Calibri", category: "sans", note: "Safest all-rounder — passes every ATS" },
  { id: "arial", label: "Arial", cssStack: "Arial, Helvetica, sans-serif", docxName: "Arial", category: "sans", note: "Universally readable" },
  { id: "helvetica", label: "Helvetica", cssStack: "Helvetica, Arial, sans-serif", docxName: "Helvetica", category: "sans", note: "Clean and modern" },
  { id: "georgia", label: "Georgia", cssStack: "Georgia, 'Times New Roman', serif", docxName: "Georgia", category: "serif", note: "Traditional — good for finance/law" },
  { id: "garamond", label: "Garamond", cssStack: "Garamond, Georgia, serif", docxName: "Garamond", category: "serif", note: "Elegant serif, space-efficient" },
];

/** Body text size — recruiters expect 10–12pt. Headings/name scale from the template. */
export type ResumeFontSizeId = "compact" | "standard" | "large";
export const RESUME_FONT_SIZES: {
  id: ResumeFontSizeId;
  label: string;
  previewPx: number;
  docxHalfPt: number;
}[] = [
  { id: "compact", label: "Compact (10pt)", previewPx: 12, docxHalfPt: 20 },
  { id: "standard", label: "Standard (11pt)", previewPx: 13, docxHalfPt: 22 },
  { id: "large", label: "Large (12pt)", previewPx: 14, docxHalfPt: 24 },
];

export function resolveResumeFont(id?: string | null) {
  return RESUME_FONTS.find((f) => f.id === id);
}
export function resolveResumeFontSize(id?: string | null) {
  return RESUME_FONT_SIZES.find((s) => s.id === id);
}

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
  /** Optional font/size overrides; when unset the template's defaults apply. */
  font?: ResumeFontId;
  fontSize?: ResumeFontSizeId;
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
      font: resolveResumeFont(parsed.font)?.id,
      fontSize: resolveResumeFontSize(parsed.fontSize)?.id,
    };
  } catch {
    // Legacy plain-text resume → drop it into the summary so nothing is lost.
    return { ...base, summary: content };
  }
}

export function serializeResume(data: ResumeData): string {
  return JSON.stringify(data);
}
