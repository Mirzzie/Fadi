import { describe, expect, it } from "vitest";

import { practiceAdapterManifestSchema, practiceReleaseCheckSchema } from "./release";

const digest = `sha256:${"a".repeat(64)}`;
const review = { reviewedBy: "maintainer@example.test", reviewedAt: "2026-10-17T12:00:00Z" };

function operation(overrides: Record<string, unknown> = {}) {
  return {
    id: "start",
    title: "Start the environment",
    effect: "Starts the isolated environment for this activity.",
    target: "environment",
    risk: "write",
    approvalCapability: "practice.environment.start",
    timeoutMs: 120_000,
    successAssessment: {
      kind: "machine_predicate",
      adapter: { id: "environment.running", version: "1" },
    },
    reversibility: "reversible",
    rollbackOperationId: "stop",
    cleanupOperationId: "stop",
    ...overrides,
  };
}

function environmentAdapter(operations: unknown[]) {
  return {
    schemaVersion: 1,
    id: "environment.vmware",
    version: "1.0.0",
    digest,
    kind: "environment",
    supports: ["virtual_machine"],
    operations,
    trust: "reviewed",
    review,
  };
}

describe("Practice adapter manifests", () => {
  it("keeps reviewed operations bounded and refers to code by id", () => {
    const result = practiceAdapterManifestSchema.safeParse(
      environmentAdapter([
        operation(),
        operation({
          id: "stop",
          title: "Stop the environment",
          risk: "write",
          reversibility: "disruptive",
          rollbackOperationId: null,
          cleanupOperationId: null,
        }),
      ])
    );
    expect(result.success).toBe(true);
    expect(JSON.stringify(result.success ? result.data : null)).not.toMatch(/command|argv|script/i);
  });

  it("rejects consequential operations that bypass approval", () => {
    const result = practiceAdapterManifestSchema.safeParse(
      environmentAdapter([operation({ approvalCapability: null })])
    );
    expect(result.success).toBe(false);
  });

  it("rejects an unbounded operation and a rollback id that does not exist", () => {
    const result = practiceAdapterManifestSchema.safeParse(
      environmentAdapter([operation({ timeoutMs: 31 * 60_000 })])
    );
    expect(result.success).toBe(false);

    const missing = practiceAdapterManifestSchema.safeParse(
      environmentAdapter([operation({ rollbackOperationId: "missing" })])
    );
    expect(missing.success).toBe(false);
  });

  it("rejects a reviewed claim without a named reviewer", () => {
    const result = practiceAdapterManifestSchema.safeParse({
      ...environmentAdapter([]),
      review: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("Practice release checks", () => {
  const passing = {
    schemaVersion: 1,
    packId: "incident-brief",
    packVersion: "1.0.0",
    packDigest: `sha256:${"c".repeat(64)}`,
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
  };

  it("accepts a bounded end-to-end rehearsal receipt", () => {
    expect(practiceReleaseCheckSchema.safeParse(passing).success).toBe(true);
  });

  it.each(["prepare", "execute", "assess", "cleanup"])(
    "will not call a release passing when %s did not pass",
    (stage) => {
      const input = {
        ...passing,
        stages: passing.stages.map((item) =>
          item.stage === stage ? { ...item, verdict: "unknown" } : item
        ),
      };
      expect(practiceReleaseCheckSchema.safeParse(input).success).toBe(false);
    }
  );

  it("rejects a receipt that expires before it was observed", () => {
    expect(
      practiceReleaseCheckSchema.safeParse({
        ...passing,
        expiresAt: "2026-10-16T12:00:00Z",
      }).success
    ).toBe(false);
  });

  it("keeps a failed rehearsal as a valid diagnosis rather than erasing it", () => {
    const failed = {
      ...passing,
      verdict: "fail",
      stages: passing.stages.map((stage) =>
        stage.stage === "assess"
          ? { ...stage, verdict: "fail", seen: "Expected output absent" }
          : stage
      ),
    };
    const parsed = practiceReleaseCheckSchema.safeParse(failed);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.verdict).toBe("fail");
  });
});
