/**
 * Structured model for the prose document kinds — cover letters, cold emails, and
 * value propositions. Mirrors `resume.ts`: content is stored as JSON, but the
 * parser is tolerant so any legacy plain-text doc (or a Scout draft that's just
 * prose) opens cleanly with its text in the Body — nothing is ever lost.
 *
 * Fonts/sizes are shared with the resume editor (the same ATS-safe set), so a
 * letter and a résumé can be styled consistently.
 */

import {
  resolveResumeFont,
  resolveResumeFontSize,
  type ResumeFontId,
  type ResumeFontSizeId,
} from "./resume";

export type ProseKind = "cover_letter" | "email" | "value_proposition";

export const PROSE_KINDS: ProseKind[] = ["cover_letter", "email", "value_proposition"];

export function isProseKind(kind: string): kind is ProseKind {
  return (PROSE_KINDS as string[]).includes(kind);
}

export type LetterData = {
  sender: { name: string; email: string; phone: string; location: string; links: string };
  /** Free-form date line on a formal letter (e.g. "13 June 2026"). */
  date: string;
  recipient: { name: string; title: string; company: string; location: string };
  /** Email subject / VPD headline. */
  subject: string;
  greeting: string;
  /** The main prose; blank lines separate paragraphs in the preview. */
  body: string;
  signOff: string;
  signature: string;
  font?: ResumeFontId;
  fontSize?: ResumeFontSizeId;
};

/** Which blocks each prose kind shows + their labels — drives form AND preview. */
export type LetterFieldConfig = {
  sender: boolean;
  date: boolean;
  recipient: boolean;
  subject: boolean;
  subjectLabel: string;
  greeting: boolean;
  signOff: boolean;
  signature: boolean;
  bodyLabel: string;
  bodyPlaceholder: string;
};

export const LETTER_FIELDS: Record<ProseKind, LetterFieldConfig> = {
  cover_letter: {
    sender: true,
    date: true,
    recipient: true,
    subject: false,
    subjectLabel: "",
    greeting: true,
    signOff: true,
    signature: true,
    bodyLabel: "Body",
    bodyPlaceholder:
      "Two to three tight paragraphs: why this role, the evidence you can do it, and the fit. One blank line between paragraphs.",
  },
  email: {
    sender: false,
    date: false,
    recipient: false,
    subject: true,
    subjectLabel: "Subject",
    greeting: true,
    signOff: true,
    signature: true,
    bodyLabel: "Body",
    bodyPlaceholder:
      "A short, specific outreach note. Lead with why you're writing, one concrete proof point, and a clear ask.",
  },
  value_proposition: {
    sender: false,
    date: false,
    recipient: false,
    subject: true,
    subjectLabel: "Headline",
    greeting: false,
    signOff: false,
    signature: false,
    bodyLabel: "Pitch",
    bodyPlaceholder:
      "The crisp case for you in this role — the problem you solve and the proof. A few lines, no fluff.",
  },
};

export function emptyLetter(kind: ProseKind): LetterData {
  return {
    sender: { name: "", email: "", phone: "", location: "", links: "" },
    date: "",
    recipient: { name: "", title: "", company: "", location: "" },
    subject: "",
    greeting: kind === "cover_letter" ? "Dear Hiring Manager," : kind === "email" ? "Hi," : "",
    body: "",
    signOff: kind === "value_proposition" ? "" : "Sincerely,",
    signature: "",
  };
}

/** Parse stored content into LetterData; tolerant of empty/legacy plain text. */
export function parseLetter(content: string, kind: ProseKind): LetterData {
  const base = emptyLetter(kind);
  if (!content?.trim()) return base;

  try {
    const parsed = JSON.parse(content) as Partial<LetterData> & Record<string, unknown>;
    // Only treat it as structured if it actually looks like a letter — otherwise
    // a stray JSON value (number, array, bare string) falls through to "body".
    const looksStructured =
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      ("body" in parsed || "sender" in parsed || "greeting" in parsed || "subject" in parsed);
    if (looksStructured) {
      return {
        sender: { ...base.sender, ...(parsed.sender ?? {}) },
        date: typeof parsed.date === "string" ? parsed.date : base.date,
        recipient: { ...base.recipient, ...(parsed.recipient ?? {}) },
        subject: typeof parsed.subject === "string" ? parsed.subject : "",
        greeting: typeof parsed.greeting === "string" ? parsed.greeting : base.greeting,
        body: typeof parsed.body === "string" ? parsed.body : "",
        signOff: typeof parsed.signOff === "string" ? parsed.signOff : base.signOff,
        signature: typeof parsed.signature === "string" ? parsed.signature : "",
        font: resolveResumeFont(parsed.font)?.id,
        fontSize: resolveResumeFontSize(parsed.fontSize)?.id,
      };
    }
    // Valid JSON but not a letter → keep the raw text as the body.
    return { ...base, body: content };
  } catch {
    // Legacy plain-text document → drop it into the body so nothing is lost.
    return { ...base, body: content };
  }
}

export function serializeLetter(data: LetterData): string {
  return JSON.stringify(data);
}

/** The signature line — falls back to the sender's name when left blank. */
export function resolveLetterSignature(data: LetterData): string {
  return data.signature || data.sender.name;
}

/**
 * Build the structured form of a Scout draft. The generator returns a complete,
 * ready-to-use letter/email (its own greeting + sign-off live inside the prose),
 * so we drop the whole thing into the Body and clear the default greeting/sign-off
 * blocks — otherwise the preview/PDF/DOCX would show them twice.
 */
export function letterFromText(text: string, kind: ProseKind): LetterData {
  return { ...emptyLetter(kind), greeting: "", signOff: "", body: text.trim() };
}

/** Readable plain-text form — for clipboard, the docx fallback, and workspace previews. */
export function letterToPlainText(data: LetterData): string {
  const blocks: string[] = [];
  if (data.subject) blocks.push(`Subject: ${data.subject}`);
  if (data.greeting) blocks.push(data.greeting);
  if (data.body) blocks.push(data.body);
  if (data.signOff) blocks.push(data.signOff);
  const sig = resolveLetterSignature(data);
  if (sig) blocks.push(sig);
  return blocks.join("\n\n").trim();
}

/** A short one-line snippet for document-list cards (prefers the body). */
export function letterSnippet(content: string, kind: ProseKind): string {
  const d = parseLetter(content, kind);
  return (d.body || d.subject || d.greeting || "").replace(/\s+/g, " ").trim();
}
