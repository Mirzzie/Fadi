/**
 * Career-history evidence — the single, honestly-labeled block that every AI
 * prompt (career report, document generation, Fadi context) uses to ground
 * claims about the candidate's experience.
 *
 * The key correctness rule: a user keeps different resumes for different roles, so
 * a single tailored resume is NOT a complete career history. When the user has
 * provided their LinkedIn profile (the fuller, role-agnostic record) we treat it
 * as the SOURCE OF TRUTH and demote the active resume to a tailored excerpt that
 * may omit experience — never something to infer gaps from.
 *
 * Pure on purpose (callers already hold the text) so it stays unit-testable and
 * the labeling/weighting lives in exactly one place.
 */

export type HistorySource = "linkedin" | "resume" | "none";

export type CareerEvidence = {
  /** Prompt-ready, labeled evidence block. */
  block: string;
  /** Which input is authoritative — for honest UI ("source: LinkedIn ✓"). */
  historySource: HistorySource;
};

const LINKEDIN_BUDGET = 8000;
const RESUME_SUPPORTING_BUDGET = 4000;
const RESUME_PRIMARY_BUDGET = 9000;
/** Below this, pasted LinkedIn is too thin to be the full record (likely a URL/handle). */
const SUBSTANTIAL_MIN = 200;

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n[truncated]` : text;
}

/** A bare URL or handle isn't a career history — treat it as "no LinkedIn text". */
function isUrlOnly(text: string): boolean {
  if (/^https?:\/\/\S+$/i.test(text) || /^(www\.)?linkedin\.com\/\S+$/i.test(text)) return true;
  return !/\s/.test(text) && text.length < 120; // single token, no prose
}

/** True when LinkedIn text is a real profile we can treat as the full record. */
export function isSubstantialLinkedIn(text?: string | null): boolean {
  const t = (text ?? "").trim();
  return t.length >= SUBSTANTIAL_MIN && !isUrlOnly(t);
}

export function composeCareerEvidence(opts: {
  resumeText?: string | null;
  linkedInText?: string | null;
}): CareerEvidence {
  const resume = (opts.resumeText ?? "").trim();
  const linkedIn = (opts.linkedInText ?? "").trim();

  // LinkedIn (when it's a real profile) is the source of truth.
  if (isSubstantialLinkedIn(linkedIn)) {
    const parts = [
      "CAREER HISTORY — the candidate's full professional record and the SOURCE OF TRUTH (ground every experience claim here):",
      clip(linkedIn, LINKEDIN_BUDGET),
    ];
    if (resume) {
      parts.push(
        "",
        "SUPPORTING RESUME — a role-tailored excerpt. It may deliberately omit relevant experience, so do NOT treat it as the complete history or infer gaps/weaknesses from what it leaves out; use it only as extra detail:",
        clip(resume, RESUME_SUPPORTING_BUDGET),
      );
    }
    return { block: parts.join("\n"), historySource: "linkedin" };
  }

  // No usable LinkedIn → the resume is the best-available record, flagged honestly.
  if (resume) {
    return {
      block: [
        "CAREER HISTORY (from the candidate's resume — note: resumes are often tailored to a specific role and may omit experience; treat as the best-available record, not exhaustive, and never invent beyond it):",
        clip(resume, RESUME_PRIMARY_BUDGET),
      ].join("\n"),
      historySource: "resume",
    };
  }

  // Nothing substantial — surface a bare LinkedIn URL if that's all we have.
  const block = linkedIn
    ? `CAREER HISTORY: none on file yet. LinkedIn reference: ${linkedIn}`
    : "CAREER HISTORY: none on file yet — keep any document honest and brief; never invent experience.";
  return { block, historySource: "none" };
}
