import "server-only";

import {
  createCareerProfilesRepository,
  createLinkedInProfilesRepository,
  createResumesRepository,
} from "@careeros/database";

import { composeCareerEvidence } from "@/lib/career/evidence";
import { getDatabase } from "@/lib/database/client";
import { truthCheck, type TruthFinding } from "@/lib/documents/truth-gate";

/**
 * The candidate's REAL record as one text blob — résumé + LinkedIn + evidence pool. This is the
 * only thing the truth gate is allowed to treat as "backed". Same formula generation uses, so a
 * document is judged against exactly the material it should have been drawn from.
 */
export async function loadCandidateCorpus(userId: string): Promise<string> {
  const db = getDatabase();
  const careerProfile = await createCareerProfilesRepository(db).getActiveForUser(userId);
  const [resume, linkedin] = await Promise.all([
    createResumesRepository(db).getLatestForTrack(userId, careerProfile?.id ?? null),
    createLinkedInProfilesRepository(db).getLatestForUser(userId),
  ]);
  const linkedInText = linkedin?.rawText ?? linkedin?.profileUrl ?? undefined;
  const evidence = composeCareerEvidence({
    resumeText: resume?.parsedText ?? resume?.rawText,
    linkedInText,
  });
  const topEvidence = await import("@/lib/evidence/pool").then((m) =>
    m.topEvidenceForPrompt(userId)
  );
  return [evidence.block, topEvidence, resume?.parsedText ?? resume?.rawText, linkedInText]
    .filter(Boolean)
    .join("\n");
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
  return truthCheck(content, { corpus, jobDescription: jobDescription ?? null });
}
