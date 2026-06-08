/**
 * Bridge between our internal `ResumeData` and the open **JSON Resume** standard
 * (jsonresume.org). This is the foundation of the hybrid template strategy:
 * once a resume is expressible as JSON Resume, we can import/export the open
 * format and render it with the large ecosystem of ATS-safe community themes.
 *
 * Mapping is deliberately tolerant and best-effort (resumes are messy): a
 * round-trip preserves the meaningful content even where exact formatting of
 * free-form fields (dates, location, links) can't be perfectly recovered.
 */

import {
  DEFAULT_SECTION_ORDER,
  newId,
  type ResumeData,
  type ResumeSectionKey,
} from "./resume";

// ─── JSON Resume types (the subset we map) ─────────────────────────────────────

export interface JsonResumeLocation {
  address?: string;
  postalCode?: string;
  city?: string;
  countryCode?: string;
  region?: string;
}
export interface JsonResumeProfile {
  network?: string;
  username?: string;
  url?: string;
}
export interface JsonResumeWork {
  name?: string; // company
  position?: string;
  url?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}
export interface JsonResumeEducation {
  institution?: string;
  area?: string;
  studyType?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
}
export interface JsonResumeSkill {
  name?: string;
  level?: string;
  keywords?: string[];
}
export interface JsonResumeProject {
  name?: string;
  description?: string;
  url?: string;
  highlights?: string[];
}
export interface JsonResume {
  $schema?: string;
  basics?: {
    name?: string;
    label?: string;
    email?: string;
    phone?: string;
    url?: string;
    summary?: string;
    location?: JsonResumeLocation;
    profiles?: JsonResumeProfile[];
  };
  work?: JsonResumeWork[];
  education?: JsonResumeEducation[];
  skills?: JsonResumeSkill[];
  projects?: JsonResumeProject[];
  meta?: Record<string, unknown> & { careeros?: { order?: ResumeSectionKey[] } };
}

const JSON_RESUME_SCHEMA =
  "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json";

// ─── helpers ───────────────────────────────────────────────────────────────────

/** Split a free-form period ("01/2024 – 06/2024", "2020 to Present") into parts. */
function splitPeriod(period: string): { startDate: string; endDate: string } {
  const parts = period.split(/\s*(?:–|—|-|\bto\b)\s*/i).map((p) => p.trim()).filter(Boolean);
  return { startDate: parts[0] ?? "", endDate: parts[1] ?? "" };
}

function joinPeriod(startDate?: string, endDate?: string): string {
  return [startDate, endDate].map((s) => (s ?? "").trim()).filter(Boolean).join(" – ");
}

function guessNetwork(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("linkedin")) return "LinkedIn";
  if (u.includes("github")) return "GitHub";
  if (u.includes("gitlab")) return "GitLab";
  if (u.includes("dribbble")) return "Dribbble";
  if (u.includes("behance")) return "Behance";
  if (u.includes("twitter") || u.includes("x.com")) return "Twitter";
  return "Website";
}

/** Parse a free-form "LinkedIn · github.com/x · portfolio.dev" links string into profiles. */
function linksToProfiles(links: string): JsonResumeProfile[] {
  return links
    .split(/\s*[·,|]\s*|\s{2,}|\s*\n\s*/)
    .map((t) => t.trim())
    .filter((t) => /\./.test(t)) // looks like a URL/handle with a dot
    .map((t) => ({ network: guessNetwork(t), url: t.startsWith("http") ? t : `https://${t}` }));
}

function profilesToLinks(profiles: JsonResumeProfile[] = [], url?: string): string {
  const all = [...profiles.map((p) => p.url ?? p.username ?? "").filter(Boolean)];
  if (url && !all.includes(url)) all.unshift(url);
  return all.join(" · ");
}

function locationToString(loc?: JsonResumeLocation): string {
  if (!loc) return "";
  return [loc.city, loc.region, loc.countryCode].map((s) => (s ?? "").trim()).filter(Boolean).join(", ") || (loc.address ?? "");
}

function skillsTextToJson(skills: string): JsonResumeSkill[] {
  return skills
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return { name: line, keywords: [] };
      const name = line.slice(0, idx).trim();
      const keywords = line
        .slice(idx + 1)
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      return { name, keywords };
    });
}

function skillsJsonToText(skills: JsonResumeSkill[] = []): string {
  return skills
    .map((s) => {
      const kws = (s.keywords ?? []).filter(Boolean);
      return kws.length ? `${s.name ?? ""}: ${kws.join(", ")}` : (s.name ?? "");
    })
    .filter(Boolean)
    .join("\n");
}

// ─── ResumeData → JSON Resume ──────────────────────────────────────────────────

export function toJsonResume(data: ResumeData): JsonResume {
  const profiles = linksToProfiles(data.personal.links);
  return {
    $schema: JSON_RESUME_SCHEMA,
    basics: {
      name: data.personal.name || undefined,
      label: data.personal.headline || undefined,
      email: data.personal.email || undefined,
      phone: data.personal.phone || undefined,
      url: profiles[0]?.url,
      summary: data.summary || undefined,
      location: data.personal.location ? { city: data.personal.location } : undefined,
      profiles: profiles.length ? profiles : undefined,
    },
    work: data.experiences.map((e) => {
      const { startDate, endDate } = splitPeriod(e.period);
      return {
        name: e.company || undefined,
        position: e.title || undefined,
        location: e.location || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        highlights: e.bullets
          .split("\n")
          .map((b) => b.trim())
          .filter(Boolean),
      };
    }),
    education: data.education.map((ed) => {
      const { startDate, endDate } = splitPeriod(ed.period);
      return {
        institution: ed.school || undefined,
        studyType: ed.degree || undefined,
        location: ed.location || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
    }),
    skills: skillsTextToJson(data.skills),
    projects: data.projects.map((p) => ({
      name: p.title || undefined,
      url: p.url || undefined,
      description: p.description || undefined,
    })),
    meta: { careeros: { order: data.order } },
  };
}

// ─── JSON Resume → ResumeData ──────────────────────────────────────────────────

export function fromJsonResume(jr: JsonResume): ResumeData {
  const basics = jr.basics ?? {};

  const order = Array.isArray(jr.meta?.careeros?.order)
    ? (jr.meta!.careeros!.order!.filter((k) =>
        (DEFAULT_SECTION_ORDER as string[]).includes(k),
      ) as ResumeSectionKey[])
    : [...DEFAULT_SECTION_ORDER];
  const seen = new Set(order);

  return {
    personal: {
      name: basics.name ?? "",
      headline: basics.label ?? "",
      email: basics.email ?? "",
      phone: basics.phone ?? "",
      location: locationToString(basics.location),
      links: profilesToLinks(basics.profiles, basics.url),
    },
    summary: basics.summary ?? "",
    experiences: (jr.work ?? []).map((w) => ({
      id: newId(),
      title: w.position ?? "",
      company: w.name ?? "",
      location: w.location ?? "",
      period: joinPeriod(w.startDate, w.endDate),
      bullets: (w.highlights && w.highlights.length ? w.highlights : w.summary ? [w.summary] : []).join("\n"),
    })),
    education: (jr.education ?? []).map((ed) => ({
      id: newId(),
      degree: [ed.studyType, ed.area].filter(Boolean).join(", "),
      school: ed.institution ?? "",
      location: ed.location ?? "",
      period: joinPeriod(ed.startDate, ed.endDate),
    })),
    skills: skillsJsonToText(jr.skills),
    projects: (jr.projects ?? []).map((p) => ({
      id: newId(),
      title: p.name ?? "",
      url: p.url ?? "",
      description: p.description ?? (p.highlights ?? []).join(" ") ?? "",
    })),
    order: [...order, ...DEFAULT_SECTION_ORDER.filter((k) => !seen.has(k))],
  };
}

/** Parse arbitrary JSON text into a JsonResume (tolerant). Throws on invalid JSON. */
export function parseJsonResume(text: string): JsonResume {
  const obj = JSON.parse(text) as JsonResume;
  if (typeof obj !== "object" || obj === null) throw new Error("Not a JSON Resume object");
  return obj;
}
