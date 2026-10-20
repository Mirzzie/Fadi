/**
 * Deterministic truth gate — makes "Never invent. Always claim." ARCHITECTURAL, not just a
 * prompt. Given a generated document and the candidate's REAL corpus (their résumé/LinkedIn +
 * evidence) plus the target job description, it flags the three classic fabrication leaks that a
 * style gate (humanize.ts) can't catch:
 *
 *   1. unsupported-number  — a metric (%, ×, money) in the draft that is nowhere in the record.
 *   2. jd-only-term        — a skill/tech term that came from the JOB DESCRIPTION but isn't in
 *                            the candidate's record (the JD contaminating the profile).
 *   3. seniority-inflation — senior-level language on an early-career record.
 *
 * Pure, no AI, no I/O — it runs with zero budget and never asks one model to police another.
 * "block" findings should stop an export; "warn" findings should surface for the user to confirm.
 */

export type TruthSeverity = "block" | "warn";
export type TruthCategory = "unsupported-number" | "jd-only-term" | "seniority-inflation";

export type TruthFinding = {
  category: TruthCategory;
  severity: TruthSeverity;
  /** The exact offending fragment, for highlighting. */
  offending: string;
  /** Plain-language, candidate-facing explanation + fix. */
  message: string;
};

export type TruthCheckInput = {
  /** The candidate's real material: résumé + LinkedIn + evidence, concatenated. */
  corpus: string;
  jobDescription?: string | null;
};

// Metric shapes that are the classic invented-résumé numbers: "30%", "3x", "$50k", "€1.2M".
// (No trailing \b: it fails after "%"/"x" since those are non-word chars.)
const METRIC_RE =
  /(?:[$€£]\s?\d[\d,]*(?:\.\d+)?\s?[kmb]?|\b\d{1,3}\s?%|\b\d+(?:\.\d+)?x(?![a-z]))/gi;

const strip = (s: string) => s.toLowerCase().replace(/[\s,]/g, "");
const digitsOf = (s: string) => strip(s).replace(/[^0-9.]/g, "");

/** A metric in the draft that appears in NO form in the candidate's record → likely invented. */
function unsupportedNumbers(generated: string, corpus: string): TruthFinding[] {
  const corpusStripped = strip(corpus);
  const corpusMetrics = new Set([...corpus.matchAll(METRIC_RE)].map((m) => strip(m[0])));
  const out: TruthFinding[] = [];
  const seen = new Set<string>();
  for (const m of generated.matchAll(METRIC_RE)) {
    const key = strip(m[0]);
    if (seen.has(key)) continue;
    seen.add(key);
    if (corpusMetrics.has(key)) continue; // exact metric present in the record
    const d = digitsOf(m[0]);
    if (d && corpusStripped.includes(d)) continue; // the number exists somewhere in the record
    out.push({
      category: "unsupported-number",
      severity: "block",
      offending: m[0].trim(),
      message: `"${m[0].trim()}" isn't anywhere in your evidence. A number that isn't in your real record reads as invented — add the source in Evidence, or remove the figure.`,
    });
  }
  return out;
}

// Non-global so `.test()` is stateless; a separate global literal is used for matching.
const SENIOR_RE =
  /\b(senior|sr\.?|lead|principal|staff|head of|director|architect|vp|chief|expert)\b/i;
const JUNIOR_RE =
  /\b(junior|jr\.?|trainee|intern(?:ship)?|graduate|entry[- ]level|apprentice|assistant)\b/i;

/** Senior-level language on a record that reads early-career (and has no senior signal of its own). */
function seniorityInflation(generated: string, corpus: string): TruthFinding[] {
  const hits = generated.match(
    /\b(senior|sr\.?|lead|principal|staff|head of|director|architect|vp|chief|expert)\b/gi
  );
  if (!hits) return [];
  if (SENIOR_RE.test(corpus)) return []; // the real record already supports senior language
  if (!JUNIOR_RE.test(corpus)) return []; // no clear early-career signal → don't guess
  const uniq = [...new Set(hits.map((h) => h.toLowerCase()))];
  return [
    {
      category: "seniority-inflation",
      severity: "warn",
      offending: uniq.join(", "),
      message: `The draft uses senior-level language (${uniq.join(", ")}) but your record reads as early-career. Recruiters check level against references — keep it truthful, or add the evidence that backs it.`,
    },
  ];
}

// Generic words that must never be flagged as a "skill from the JD".
const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "you",
  "your",
  "our",
  "are",
  "was",
  "will",
  "have",
  "has",
  "that",
  "this",
  "from",
  "role",
  "team",
  "work",
  "working",
  "experience",
  "experienced",
  "skills",
  "ability",
  "strong",
  "good",
  "great",
  "excellent",
  "join",
  "looking",
  "seeking",
  "candidate",
  "candidates",
  "opportunity",
  "company",
  "business",
  "responsibilities",
  "requirements",
  "including",
  "across",
  "within",
  "using",
  "use",
  "used",
  "help",
  "support",
  "environment",
  "teams",
  "projects",
  "project",
  "years",
  "year",
  "new",
  "other",
  "more",
  "must",
  "should",
  "able",
  "knowledge",
  "understanding",
  "across",
  "related",
  "relevant",
  "ideal",
  "plus",
  "etc",
  "who",
  "how",
  "what",
  "when",
]);

const tokenize = (s: string) => s.toLowerCase().match(/[a-z][a-z0-9+#.]{3,}/g) ?? [];

/** Terms present in BOTH the draft and the JD but ABSENT from the record → JD contamination. */
function jdOnlyTerms(
  generated: string,
  corpus: string,
  jd: string | null | undefined
): TruthFinding[] {
  if (!jd || !jd.trim()) return [];
  const corpusSet = new Set(tokenize(corpus));
  const jdSet = new Set(tokenize(jd));
  const out: TruthFinding[] = [];
  const flagged = new Set<string>();
  for (const t of new Set(tokenize(generated))) {
    if (STOP.has(t) || flagged.has(t)) continue;
    if (!jdSet.has(t) || corpusSet.has(t)) continue; // must be from the JD and NOT in the record
    flagged.add(t);
    out.push({
      category: "jd-only-term",
      severity: "warn",
      offending: t,
      message: `"${t}" appears in the job description and your draft, but not in your evidence. Make sure you can genuinely back it — otherwise drop it rather than mirror the posting.`,
    });
    if (out.length >= 12) break; // cap noise
  }
  return out;
}

/** Run every deterministic truth check. Block-severity findings should stop an export. */
export function truthCheck(generated: string, input: TruthCheckInput): TruthFinding[] {
  const corpus = input.corpus ?? "";
  return [
    ...unsupportedNumbers(generated, corpus),
    ...seniorityInflation(generated, corpus),
    ...jdOnlyTerms(generated, corpus, input.jobDescription ?? null),
  ];
}

export function hasBlockingFindings(findings: TruthFinding[]): boolean {
  return findings.some((f) => f.severity === "block");
}
