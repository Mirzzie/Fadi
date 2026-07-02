import type { DocKind } from "@/lib/jobs/application-types";

/**
 * Per-document recruiter guidance, grounded in 2026 sources. Each document type
 * has different length/structure/tone norms — a cover letter is not a cold
 * email is not a value proposition — so the editor advises each one specifically.
 *
 * These norms shift over time, so the guidance is VERSIONED and dated: bump
 * `DOC_GUIDANCE_VERSION` and the per-doc `reviewed` date when it's refreshed, and
 * the editor alerts the user that the advice changed. (A future scheduled job
 * could refresh this from the cited sources — see docs; for now it's curated.)
 */
export const DOC_GUIDANCE_VERSION = "2026.07";

export type DocTip = { label: string; text: string };
export type DocGuidance = {
  label: string;
  /** Recommended length, in words, as a live target range. */
  words: { min: number; max: number; note: string };
  tips: DocTip[];
  sources: string;
  reviewed: string; // ISO date this guidance was last reviewed
};

export const DOC_GUIDANCE: Partial<Record<DocKind, DocGuidance>> = {
  cover_letter: {
    label: "Cover letter",
    words: { min: 250, max: 400, note: "One page, 3–4 short paragraphs" },
    tips: [
      { label: "Length", text: "250–400 words attached (100–200 if pasted in an email body). Recruiters spend under 30 seconds — every line must earn its place." },
      { label: "Structure", text: "Hook → why you fit → one real proof point → a confident close. 94% of hiring managers say cover letters influence interview decisions." },
      { label: "Opening", text: "First 40–60 words: name the role and lead with a specific result, not 'I am writing to apply'." },
      { label: "Format", text: "Clean font (Arial or Calibri), 11pt, one-inch margins." },
    ],
    sources: "Resume.io, Microsoft, Kickresume, ResumeGenius hiring-manager survey (2026)",
    reviewed: "2026-07-04",
  },
  email: {
    label: "Cold email",
    words: { min: 50, max: 150, note: "Shorter wins — recruiters skim" },
    tips: [
      { label: "Length", text: "50–150 words — 101–150 is the engagement sweet spot (2024 analysis of 4M recruiting emails). Most people write 170–210: 20–40% over the ideal." },
      { label: "Subject", text: "6–10 words, specific: the role + your name, or a concrete result. No vague subjects." },
      { label: "The ask", text: "End with ONE low-friction call to action — a 15-minute call. Never 'Are you hiring?'." },
      { label: "Personalize", text: "Reference something real about them — a product, a recent hire, a value. Personalized outreach replies at ~7.5% vs 2–3% for mass blasts (Hunter.io 2026)." },
    ],
    sources: "Juicebox, Jobply, ZeroBounce, Hunter.io State of Cold Email (2026)",
    reviewed: "2026-07-04",
  },
  value_proposition: {
    label: "Value proposition",
    words: { min: 120, max: 180, note: "Brief and punchy" },
    tips: [
      { label: "Length", text: "~120–180 words. A tight pitch, not an essay." },
      { label: "Focus", text: "Lead with future impact — the first things you'd fix in your first months — not a recap of past duties." },
      { label: "Proof", text: "Quantify: revenue generated, time saved, % improved. Numbers separate you from the field." },
      { label: "Align", text: "Mirror the role's real keywords where you genuinely match — never claim what you can't back." },
    ],
    sources: "Indeed, Askcruit, LinkedIn (2026)",
    reviewed: "2026-06-08",
  },
};

/** Count words in a draft (whitespace-delimited, ignoring empties). */
export function wordCount(text: string): number {
  const t = (text ?? "").trim();
  return t ? t.split(/\s+/).length : 0;
}

export type LengthStatus = "empty" | "short" | "ok" | "long";
export function lengthStatus(count: number, words: DocGuidance["words"]): LengthStatus {
  if (count === 0) return "empty";
  if (count < words.min) return "short";
  if (count > words.max) return "long";
  return "ok";
}
