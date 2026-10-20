import { describe, expect, it } from "vitest";

import { projectAttention } from "./attention";

describe("attention projection", () => {
  it("projects review and machine decisions once, with their source ids", () => {
    const items = projectAttention({
      evidenceReviewCount: 2,
      labRequests: [
        {
          id: "request-1",
          summary: "Start the Wazuh service beside the lab.",
          expiresAt: new Date("2026-10-16T18:05:00Z"),
          reversal: "Stop the service.",
          runId: "run-1",
          stepId: "step-1",
        },
      ],
    });

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "evidence-review",
      source: { type: "evidence_review", id: "pending" },
    });
    expect(items[1]).toMatchObject({
      id: "lab-action:request-1",
      source: { type: "lab_action", id: "request-1" },
      severity: "normal",
    });
  });

  it("raises irreversible requests without inventing another approval record", () => {
    const [item] = projectAttention({
      evidenceReviewCount: 0,
      labRequests: [
        {
          id: "request-2",
          summary: "Remove the lab disk.",
          expiresAt: new Date("2026-10-16T18:05:00Z"),
          reversal: null,
          runId: null,
          stepId: null,
        },
      ],
    });
    expect(item).toMatchObject({
      severity: "high",
      source: { type: "lab_action", id: "request-2" },
    });
  });
});
