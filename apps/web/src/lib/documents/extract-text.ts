import "server-only";

import WordExtractor from "word-extractor";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";

/**
 * Plain-text extraction from the file types people actually have their CVs in —
 * PDF, DOCX, legacy DOC, and TXT — using pure-JS libraries (no LibreOffice or
 * native binaries, so it runs anywhere). Returns the raw text; structuring it
 * into resume fields is a separate, AI-assisted step (see import-resume.ts).
 */

export type SupportedDocExt = "pdf" | "docx" | "doc" | "txt";

const EXT_BY_MIME: Record<string, SupportedDocExt> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "text/plain": "txt",
};

/** Best-effort file-type detection from filename extension, then MIME. */
export function detectDocType(filename: string, mime?: string): SupportedDocExt | "json" | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf" || ext === "docx" || ext === "doc" || ext === "txt") return ext;
  if (ext === "json") return "json";
  if (mime && EXT_BY_MIME[mime]) return EXT_BY_MIME[mime];
  return null;
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractPdfText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

async function extractWord(buffer: Buffer): Promise<string> {
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  return doc.getBody();
}

/**
 * Extract plain text from a CV/document file. Throws if the type is unsupported
 * or the file can't be read — callers surface an honest error.
 */
export async function extractDocumentText(
  buffer: Buffer,
  filename: string,
  mime?: string,
): Promise<string> {
  const type = detectDocType(filename, mime);
  switch (type) {
    case "pdf":
      return (await extractPdf(buffer)).trim();
    case "docx":
    case "doc":
      return (await extractWord(buffer)).trim();
    case "txt":
      return buffer.toString("utf-8").trim();
    default:
      throw new Error("Unsupported file type — use PDF, DOCX, DOC, TXT, or JSON Resume.");
  }
}
