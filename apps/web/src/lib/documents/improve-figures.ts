import { METRIC_RE } from "@/lib/documents/truth-gate";

/**
 * Figures the person ASKED for that are neither in their record nor in the result.
 *
 * Deterministic and pure: the numbers in the instruction, minus the ones their record supports,
 * minus the ones the rewrite actually wrote. What is left is what Fadi declined to claim — and it
 * has to be said out loud, or a "Rewritten" message implies the number went in.
 */
export function figuresAskedButNotWritten(
  instructionText: string,
  corpus: string,
  result: string
): string[] {
  const asked = instructionText.match(METRIC_RE) ?? [];
  const seen = new Set<string>();
  return asked
    .map((figure) => figure.trim())
    .filter((figure) => {
      const key = figure.toLowerCase().replace(/\s+/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      const inCorpus = corpus.toLowerCase().replace(/\s+/g, "").includes(key);
      const inResult = result.toLowerCase().replace(/\s+/g, "").includes(key);
      return !inCorpus && !inResult;
    });
}
