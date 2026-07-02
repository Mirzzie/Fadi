import type { LearningCommitment } from "@careeros/database";

/** Client-safe view of a learning commitment (pure — no server-only deps). */
export type CommitmentView = {
  id: string;
  gap: string;
  title: string;
  detail: string;
  kind: string;
  searchQuery: string | null;
  status: string;
};

export function toCommitmentView(c: LearningCommitment): CommitmentView {
  return {
    id: c.id,
    gap: c.gap,
    title: c.title,
    detail: c.detail,
    kind: c.kind,
    searchQuery: c.searchQuery,
    status: c.status,
  };
}
