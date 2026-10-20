import type { LabActionRequest } from "@careeros/database";

/** One read projection over existing decision authorities. Resolving it always uses its source. */
export type AttentionItem = {
  id: string;
  source: { type: "evidence_review" | "lab_action"; id: string };
  state: "waiting";
  severity: "normal" | "high";
  title: string;
  detail: string;
  href: string;
  cta: string;
  expiresAt: string | null;
};

export function projectAttention(input: {
  evidenceReviewCount: number;
  labRequests: Pick<
    LabActionRequest,
    "id" | "summary" | "expiresAt" | "reversal" | "runId" | "stepId"
  >[];
}): AttentionItem[] {
  return [
    ...(input.evidenceReviewCount > 0
      ? [
          {
            id: "evidence-review",
            source: { type: "evidence_review" as const, id: "pending" },
            state: "waiting" as const,
            severity: "normal" as const,
            title:
              input.evidenceReviewCount === 1
                ? "One import is waiting on you"
                : `${input.evidenceReviewCount} imports are waiting on you`,
            detail: "Fadi could not tell whether these are the same thing you already have.",
            href: "/dashboard/evidence",
            cta: "Review them",
            expiresAt: null,
          },
        ]
      : []),
    ...input.labRequests.map<AttentionItem>((request) => ({
      id: `lab-action:${request.id}`,
      source: { type: "lab_action", id: request.id },
      state: "waiting",
      severity: request.reversal ? "normal" : "high",
      title: "Fadi is asking to run something",
      detail: request.summary,
      href: "/dashboard/learning",
      cta: "Decide",
      expiresAt: request.expiresAt.toISOString(),
    })),
  ];
}
