import { parseJSONResume } from "@reactive-resume/import/json-resume";
import type { ResumeData as ReactiveResumeData } from "@reactive-resume/schema/resume/data";

import { toJsonResume, type JsonResume } from "./json-resume";
import type { ResumeData } from "./resume";

// The doctrine-safe bridge (ADR 0010, Phase 3): render Fadi's real résumé through Reactive
// Resume templates WITHOUT inventing anything. We never hand-map fields — we chain two
// existing, tested converters via the open JSON Resume standard:
//
//   Fadi ResumeData  --toJsonResume-->  JSON Resume  --parseJSONResume-->  rxresume ResumeData
//
// The user's verified history stays the source of truth; the rxresume schema is just a
// different rendering shape for the same content.

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/**
 * Coerce a free-text date into ISO 8601 (`YYYY`, `YYYY-MM`, or `YYYY-MM-DD`), or `undefined`.
 * Reactive Resume's importer rejects anything else, whereas Fadi stores human periods like
 * "01/2024", "March 2022" or "Present". Open-ended markers and unparseable text → undefined
 * (the résumé still renders, just without that date) rather than a hard validation failure.
 */
function toIso(value?: string): string | undefined {
  if (!value) return undefined;
  const s = value.trim();
  if (!s || /^(present|current|now|ongoing|to date|date)$/i.test(s)) return undefined;
  if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(s)) return s; // already ISO
  let m = s.match(/^(\d{1,2})[\/.\-](\d{4})$/); // MM/YYYY
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})[\/.\-](\d{1,2})$/); // YYYY/MM
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  m = s.match(/^([A-Za-z]{3,})\.?\s+(\d{4})$/); // "March 2022" / "Mar 2022"
  if (m) {
    const mm = MONTHS[m[1].slice(0, 3).toLowerCase()];
    return mm ? `${m[2]}-${mm}` : m[2];
  }
  m = s.match(/\b(\d{4})\b/); // any 4-digit year as a last resort
  return m ? m[1] : undefined;
}

/** Normalize every date the RR importer validates; leave everything else untouched. */
function sanitizeDates(jr: JsonResume): JsonResume {
  const range = <T extends { startDate?: string; endDate?: string }>(x: T): T => ({
    ...x,
    startDate: toIso(x.startDate),
    endDate: toIso(x.endDate),
  });
  return {
    ...jr,
    work: jr.work?.map(range),
    education: jr.education?.map(range),
    volunteer: jr.volunteer?.map(range),
    awards: jr.awards?.map((a) => ({ ...a, date: toIso(a.date) })),
    certificates: jr.certificates?.map((c) => ({ ...c, date: toIso(c.date) })),
    publications: jr.publications?.map((p) => ({ ...p, releaseDate: toIso(p.releaseDate) })),
  };
}

export function fadiToReactiveResume(data: ResumeData): ReactiveResumeData {
  const jsonResume = sanitizeDates(toJsonResume(data));
  const rr = parseJSONResume(JSON.stringify(jsonResume));
  // JSON Resume's `image` doesn't reliably land on RR's picture, so set it explicitly on the
  // valid default picture object the importer produces.
  const photo = data.personal.photo?.trim();
  if (photo) rr.picture = { ...rr.picture, url: photo, hidden: false };
  return rr;
}
