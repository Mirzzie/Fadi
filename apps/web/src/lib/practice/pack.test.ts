import { describe, expect, it } from "vitest";

import { evaluatePracticePack, type PracticePack } from "./pack";
import type { PracticeReleaseContext } from "./release";

const adapter = (id: string) => ({ id, version: "1.0.0" });
const digest = `sha256:${"a".repeat(64)}`;
const packDigest = `sha256:${"c".repeat(64)}`;

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

function release(overrides: Partial<PracticeReleaseContext> = {}): PracticeReleaseContext {
  return {
    adapters: [
      {
        schemaVersion: 1,
        id: "rubric.incident-brief",
        version: "1.0.0",
        digest,
        kind: "assessment",
        supports: ["rubric"],
        operations: [],
        trust: "reviewed",
        review: { reviewedBy: "maintainer@example.test", reviewedAt: "2026-10-17T12:00:00Z" },
      },
    ],
    checks: [
      {
        schemaVersion: 1,
        packId: "incident-brief",
        packVersion: "1.0.0",
        packDigest,
        activityId: "brief",
        verdict: "pass",
        adapterDigests: [{ id: "rubric.incident-brief", version: "1.0.0", digest }],
        environmentFingerprint: "fadi:test:document-v1",
        stages: ["prepare", "execute", "assess", "cleanup"].map((stage) => ({
          stage,
          verdict: "pass",
          seen: `${stage} passed`,
        })),
        verifiedAt: "2026-10-17T12:00:00Z",
        expiresAt: "2027-01-17T12:00:00Z",
      },
    ],
    environmentFingerprint: "fadi:test:document-v1",
    packDigest,
    now: new Date("2026-10-18T12:00:00Z"),
    ...overrides,
  };
}

describe("Practice pack evaluation", () => {
  it("allows a reviewed non-technical pack to be recommended", () => {
    expect(evaluatePracticePack(pack(), release())).toEqual({
      valid: true,
      recommendable: true,
      issues: [],
    });
  });

  it("does not confuse a human-reviewed file with a working release", () => {
    const result = evaluatePracticePack(pack());
    expect(result.valid).toBe(true);
    expect(result.recommendable).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "adapter_unavailable",
      "release_check_missing",
    ]);
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

  it("requires the rehearsal to bind the exact installed adapter digest", () => {
    const context = release();
    const check = context.checks[0] as { adapterDigests: Array<{ digest: string }> };
    check.adapterDigests[0].digest = `sha256:${"b".repeat(64)}`;
    const result = evaluatePracticePack(pack(), context);
    expect(result.recommendable).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("release_adapter_mismatch");
  });

  it("requires the rehearsal to bind the exact pack content, not only its name and version", () => {
    const context = release({ packDigest: `sha256:${"d".repeat(64)}` });
    const result = evaluatePracticePack(pack(), context);
    expect(result.recommendable).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("release_content_mismatch");
  });

  it("does not accept an adapter with the right name but the wrong role", () => {
    const context = release();
    context.adapters = [
      {
        ...(context.adapters[0] as Record<string, unknown>),
        kind: "environment",
        supports: ["document"],
        operations: [],
      },
    ];
    const result = evaluatePracticePack(pack(), context);
    expect(result.recommendable).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("adapter_kind_mismatch");
  });

  it("preserves a failed rehearsal and refuses to recommend the release", () => {
    const context = release();
    context.checks = [
      {
        ...(context.checks[0] as Record<string, unknown>),
        verdict: "fail",
        stages: ["prepare", "execute", "assess", "cleanup"].map((stage) => ({
          stage,
          verdict: stage === "assess" ? "fail" : "pass",
          seen: stage === "assess" ? "Expected output absent" : `${stage} passed`,
        })),
      },
    ];
    const result = evaluatePracticePack(pack(), context);
    expect(result.recommendable).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("release_check_failed");
  });

  it("does not silently fall back to an older pass when matching release evidence is malformed", () => {
    const context = release();
    context.checks.push({
      packId: "incident-brief",
      packVersion: "1.0.0",
      activityId: "brief",
      verdict: "pass",
      verifiedAt: "later but incomplete",
    });
    const result = evaluatePracticePack(pack(), context);
    expect(result.recommendable).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("release_check_invalid");
  });

  it("expires a rehearsal and refuses one from a different environment", () => {
    const result = evaluatePracticePack(
      pack(),
      release({
        now: new Date("2028-01-01T00:00:00Z"),
        environmentFingerprint: "fadi:production:document-v2",
      })
    );
    expect(result.recommendable).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "release_check_expired",
      "release_environment_mismatch",
    ]);
  });
});
