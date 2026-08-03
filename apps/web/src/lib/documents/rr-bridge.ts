import { parseJSONResume } from "@reactive-resume/import/json-resume";
import type { ResumeData as ReactiveResumeData } from "@reactive-resume/schema/resume/data";

import { toJsonResume } from "./json-resume";
import type { ResumeData } from "./resume";

// The doctrine-safe bridge (ADR 0010, Phase 3): render Fadi's real résumé through Reactive
// Resume templates WITHOUT inventing anything. We never hand-map fields — we chain two
// existing, tested converters via the open JSON Resume standard:
//
//   Fadi ResumeData  --toJsonResume-->  JSON Resume  --parseJSONResume-->  rxresume ResumeData
//
// The user's verified history stays the source of truth; the rxresume schema is just a
// different rendering shape for the same content.
export function fadiToReactiveResume(data: ResumeData): ReactiveResumeData {
  const jsonResume = toJsonResume(data);
  return parseJSONResume(JSON.stringify(jsonResume));
}
