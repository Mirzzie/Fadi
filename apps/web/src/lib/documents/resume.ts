/**
 * Structured resume model. A resume document stores this as JSON in
 * `documents.content` so the form editor and live preview share one shape, and
 * Fadi can later generate straight into it (Phase 3) or export it (Phase 4).
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

// Certifications & licenses — critical for many non-tech careers (nursing licenses,
// trade certs, CPA/CFA, teaching registration, forklift/HGV, etc.), not just tech.
export type ResumeCertification = {
  id: string;
  name: string; // e.g. "Registered Nurse (RN)", "AWS Solutions Architect", "CPA"
  issuer: string; // the awarding body — e.g. "NMBI", "Amazon Web Services"
  date: string; // year or range — e.g. "2024" or "2024 – 2027"
};

// Languages — universally relevant (healthcare, hospitality, translation, any global role).
export type ResumeLanguage = {
  id: string;
  name: string; // e.g. "English", "Arabic", "Irish"
  level: string; // e.g. "Native", "Fluent (C2)", "Intermediate (B1)"
};

// Awards & honours — academia, sales, military, arts, and beyond.
export type ResumeAward = {
  id: string;
  title: string; // e.g. "Employee of the Year"
  awarder: string; // who gave it
  date: string;
};

// Volunteer / community experience — career-changers, students, healthcare, nonprofit.
export type ResumeVolunteer = {
  id: string;
  organization: string;
  role: string;
  period: string;
  summary: string; // one line, what you did
};

// References — common in UK/IE, healthcare, education ("available on request" or named).
export type ResumeReference = {
  id: string;
  name: string;
  reference: string; // role/relationship + contact, e.g. "Manager, Acme — jane@acme.com"
};

// Interests / hobbies — valued in some regions and fields (and for culture-fit signalling).
export type ResumeInterest = {
  id: string;
  name: string; // e.g. "Photography"
  keywords: string; // comma-separated, e.g. "landscape, film"
};

// Publications — academia, research, medicine, law.
export type ResumePublication = {
  id: string;
  name: string; // title of the work
  publisher: string;
  date: string;
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
export type ResumeSectionKey =
  | "summary"
  | "experiences"
  | "projects"
  | "education"
  | "certifications"
  | "skills"
  | "languages"
  | "awards"
  | "volunteer"
  | "references"
  | "interests"
  | "publications";
export const DEFAULT_SECTION_ORDER: ResumeSectionKey[] = [
  "summary",
  "experiences",
  "projects",
  "education",
  "certifications",
  "skills",
  "languages",
  "awards",
  "volunteer",
  "publications",
  "interests",
  "references",
];

export type ResumeData = {
  personal: {
    name: string;
    headline: string;
    email: string;
    phone: string;
    location: string;
    links: string; // "LinkedIn · GitHub · Portfolio" freeform
    // Optional headshot URL — expected on résumés in much of Europe/Asia/Middle East and in
    // fields like hospitality, healthcare and the arts. Blank = no photo (common in US/UK/tech).
    photo?: string;
  };
  summary: string;
  experiences: ResumeExperience[];
  education: ResumeEducation[];
  certifications: ResumeCertification[];
  languages: ResumeLanguage[];
  awards: ResumeAward[];
  volunteer: ResumeVolunteer[];
  references: ResumeReference[];
  interests: ResumeInterest[];
  publications: ResumePublication[];
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
    personal: { name: "", headline: "", email: "", phone: "", location: "", links: "", photo: "" },
    summary: "",
    experiences: [],
    education: [],
    certifications: [],
    languages: [],
    awards: [],
    volunteer: [],
    references: [],
    interests: [],
    publications: [],
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
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
      languages: Array.isArray(parsed.languages) ? parsed.languages : [],
      awards: Array.isArray(parsed.awards) ? parsed.awards : [],
      volunteer: Array.isArray(parsed.volunteer) ? parsed.volunteer : [],
      references: Array.isArray(parsed.references) ? parsed.references : [],
      interests: Array.isArray(parsed.interests) ? parsed.interests : [],
      publications: Array.isArray(parsed.publications) ? parsed.publications : [],
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

/**
 * Flatten structured resume data into plain text — for keyword/quality scoring
 * and other text analyzers that want the resume as a recruiter would read it.
 */
export function resumeToPlainText(data: ResumeData): string {
  const parts: string[] = [];
  const p = data.personal;
  if (p.name) parts.push(p.name);
  if (p.headline) parts.push(p.headline);
  if (data.summary.trim()) parts.push(data.summary.trim());

  for (const exp of data.experiences) {
    const header = [exp.title, exp.company, exp.location, exp.period].filter(Boolean).join(" · ");
    if (header) parts.push(header);
    if (exp.bullets.trim()) parts.push(exp.bullets.trim());
  }
  for (const proj of data.projects) {
    const header = [proj.title, proj.url].filter(Boolean).join(" · ");
    if (header) parts.push(header);
    if (proj.description.trim()) parts.push(proj.description.trim());
  }
  for (const edu of data.education) {
    const line = [edu.degree, edu.school, edu.location, edu.period].filter(Boolean).join(" · ");
    if (line) parts.push(line);
  }
  if (data.skills.trim()) parts.push(data.skills.trim());

  return parts.join("\n");
}
