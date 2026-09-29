import { describe, expect, it } from "vitest";

import type { SelectedRecord } from "@/lib/career/selection";
import { selectProjectProof } from "./project-proof";

function record(
  factId: string,
  kind: string,
  title: string,
  score: number,
  matched: string[] = []
): SelectedRecord {
  return {
    factId,
    evidenceId: `${factId}-evidence`,
    kind,
    title,
    organization: null,
    period: null,
    detail: "Recorded work",
    metrics: null,
    attribution: "personal",
    tags: [],
    marketTags: [],
    updatedAt: "2026-09-29T00:00:00.000Z",
    mode: "auto",
    keepWording: false,
    sortOrder: 0,
    score,
    matched,
  };
}

describe("project proof for a job", () => {
  it("chooses the strongest selected project rather than another record or list order", () => {
    const proof = selectProjectProof(
      [
        record("experience", "experience", "Support role", 30),
        record("weaker", "project", "Generic lab", 4, ["linux"]),
        record("best", "project", "Detection pipeline", 18, ["siem", "incident triage"]),
      ],
      []
    );

    expect(proof).toMatchObject({
      factId: "best",
      title: "Detection pipeline",
      matched: ["siem", "incident triage"],
    });
  });

  it("does not turn one incidental prose overlap into a claimed match", () => {
    expect(selectProjectProof([record("project", "project", "Weak overlap", 4)], [])).toBeNull();
  });

  it("keeps only public links owned by the chosen fact", () => {
    const proof = selectProjectProof(
      [record("best", "project", "Detection pipeline", 18, ["siem"])],
      [
        {
          factId: "other",
          kind: "video",
          url: "https://example.com/wrong",
          label: null,
          sortOrder: 0,
        },
        {
          factId: "best",
          kind: "repository",
          url: "javascript:alert(1)",
          label: "Unsafe",
          sortOrder: 0,
        },
        {
          factId: "best",
          kind: "video",
          url: "https://example.com/demo",
          label: "Walkthrough",
          sortOrder: 2,
        },
        {
          factId: "best",
          kind: "repository",
          url: "https://github.com/example/project",
          label: null,
          sortOrder: 1,
        },
      ]
    );

    expect(proof?.artifacts).toEqual([
      { kind: "repository", url: "https://github.com/example/project", label: null },
      { kind: "video", url: "https://example.com/demo", label: "Walkthrough" },
    ]);
  });
});
