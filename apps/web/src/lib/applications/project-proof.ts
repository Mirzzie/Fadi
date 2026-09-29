import type { EvidenceArtifact } from "@careeros/database";

import type { SelectedRecord } from "@/lib/career/selection";

export type ProjectProof = {
  factId: string;
  title: string;
  matched: string[];
  artifacts: Array<{
    kind: string;
    url: string;
    label: string | null;
  }>;
};

// One incidental body-word overlap scores 2. Requiring 5 means the project has
// at least one tag-level match or several independent prose matches before Fadi
// presents it as proof for a vacancy.
const MIN_PROJECT_PROOF_SCORE = 5;

function publicUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Choose one honest proof point from the exact records already selected for this
 * application. This deliberately does not introduce another preference or AI
 * decision: the career context remains the single selection authority.
 */
export function selectProjectProof(
  records: SelectedRecord[],
  artifacts: Pick<EvidenceArtifact, "factId" | "kind" | "url" | "label" | "sortOrder">[]
): ProjectProof | null {
  const project = records
    .filter((record) => record.kind === "project" && record.score >= MIN_PROJECT_PROOF_SCORE)
    .sort((a, b) => b.score - a.score)[0];
  if (!project) return null;

  return {
    factId: project.factId,
    title: project.title,
    matched: [...new Set(project.matched.map((term) => term.trim()).filter(Boolean))].slice(0, 4),
    artifacts: artifacts
      .filter((artifact) => artifact.factId === project.factId && publicUrl(artifact.url))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ kind, url, label }) => ({ kind, url, label })),
  };
}
