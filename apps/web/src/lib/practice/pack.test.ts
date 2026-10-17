import { describe, expect, it } from "vitest";

import { evaluatePracticePack, type PracticePack } from "./pack";

const adapter = (id: string) => ({ id, version: "1.0.0" });

function pack(overrides: Partial<PracticePack> = {}): PracticePack {
  return {
    schemaVersion: 1,
    id: "incident-brief",
    version: "1.0.0",
    title: "Write an incident brief",
    domain: { id: "operations", label: "Operations" },
    license: "CC-BY-4.0",
    trust: "reviewed",
    review: { reviewedBy: "maintainer@example.test", reviewedAt: "2026-10-17T12:00:00Z" },
    sources: [
      {
        title: "Maintainer guide",
        url: "https://example.test/guide",
        checkedAt: "2026-10-17T12:00:00Z",
      },
    ],
    activities: [
      {
        schemaVersion: 1,
        id: "brief",
        title: "Prepare the brief",
        outcome: "Produce a concise incident brief for a decision maker.",
        competencies: ["written communication"],
        steps: [
          {
            id: "draft",
            title: "Draft the brief",
            instruction: "Write the brief from the supplied case notes.",
            environment: { kind: "document", adapter: null },
            assessment: { kind: "rubric", adapter: adapter("rubric.incident-brief") },
            outputs: [{ kind: "file", required: true }],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("Practice pack evaluation", () => {
  it("allows a reviewed non-technical pack to be recommended", () => {
    expect(evaluatePracticePack(pack())).toEqual({ valid: true, recommendable: true, issues: [] });
  });

  it("keeps an otherwise valid experimental pack visibly experimental", () => {
    const result = evaluatePracticePack(pack({ trust: "experimental", review: null }));
    expect(result.valid).toBe(true);
    expect(result.recommendable).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(["experimental"]);
  });

  it("refuses a VM activity with no implementation adapter", () => {
    const input = pack();
    const step = input.activities[0].steps[0];
    step.environment = { kind: "virtual_machine", adapter: null };
    step.assessment = { kind: "machine_predicate", adapter: adapter("check.service") };
    step.outputs = [{ kind: "machine_receipt", required: true }];
    const result = evaluatePracticePack(input);
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("missing_environment_adapter");
  });

  it("refuses a rubric or machine predicate that names no implementation", () => {
    const input = pack();
    input.activities[0].steps[0].assessment.adapter = null;
    const result = evaluatePracticePack(input);
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("missing_assessment_adapter");
  });

  it("does not confuse an external completion claim with a credential output", () => {
    const input = pack();
    const step = input.activities[0].steps[0];
    step.environment = { kind: "external_tool", adapter: adapter("lti.launch") };
    step.assessment = { kind: "external_credential", adapter: adapter("badge.verify") };
    step.outputs = [{ kind: "link", required: true }];
    const result = evaluatePracticePack(input);
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("credential_without_output");
  });

  it("rejects a reviewed label without a named review", () => {
    const result = evaluatePracticePack(pack({ review: null }));
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe("invalid_pack");
  });
});
