import "server-only";

import { buildCareerContext } from "@/lib/career/context";
import { coverageGaps, truthCheck, type TruthFinding } from "@/lib/documents/truth-gate";

/** A current-history audit may consult all accepted records. Raw imports are not authority.
 * Generation checks its own captured selection, rather than reloading this broader corpus.
 */
export async function loadCandidateCorpus(userId: string): Promise<string> {
  return (await buildCareerContext(userId, { all: true })).block;
}

/**
 * Re-check a document AS IT STANDS NOW against the candidate's CURRENT record — so if they've
 * since added the evidence, a previously-flagged claim clears; if they edited in a number that
 * isn't backed, it's caught. This is what the review view and the export gate call.
 */
export async function checkDocumentTruth(
  userId: string,
  content: string,
  jobDescription?: string | null
): Promise<TruthFinding[]> {
  const corpus = await loadCandidateCorpus(userId);
  return [
    ...truthCheck(content, { corpus, jobDescription: jobDescription ?? null }),
    ...coverageGaps(content).map(
      (gap): TruthFinding => ({
        category: "unchecked-claim",
        severity: "warn",
        offending: gap.offending,
        message: gap.message,
      }),
    ),
  ];
}
