import { z } from "zod";

import {
  adapterRefSchema,
  practiceAssessmentKinds,
  practiceEnvironmentKinds,
  type PracticeAssessmentKind,
  type PracticeEnvironmentKind,
} from "./contract";

export const practiceAdapterRefSchema = adapterRefSchema;

const namedReviewSchema = z
  .object({
    reviewedBy: z.string().trim().min(1).max(160),
    reviewedAt: z.string().datetime({ offset: true }),
  })
  .strict();

const operationSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(160),
    effect: z.string().trim().min(1).max(500),
    target: z.enum(["host", "workspace", "environment", "external_service"]),
    risk: z.enum(["read", "write", "external"]),
    approvalCapability: z.string().trim().min(1).max(160).nullable(),
    timeoutMs: z
      .number()
      .int()
      .min(100)
      .max(30 * 60_000),
    successAssessment: z
      .object({
        kind: z.enum(practiceAssessmentKinds),
        adapter: practiceAdapterRefSchema,
      })
      .strict(),
    reversibility: z.enum(["reversible", "disruptive", "irreversible"]),
    rollbackOperationId: z.string().trim().min(1).max(120).nullable(),
    cleanupOperationId: z.string().trim().min(1).max(120).nullable(),
  })
  .strict()
  .superRefine((operation, context) => {
    if (operation.risk !== "read" && !operation.approvalCapability) {
      context.addIssue({
        code: "custom",
        path: ["approvalCapability"],
        message: "A write or external operation must name its approval capability.",
      });
    }
    if (operation.reversibility === "reversible" && !operation.rollbackOperationId) {
      context.addIssue({
        code: "custom",
        path: ["rollbackOperationId"],
        message: "A reversible operation must name its rollback operation.",
      });
    }
  });

const adapterBase = {
  schemaVersion: z.literal(1),
  id: z.string().trim().min(1).max(120),
  version: z.string().trim().min(1).max(40),
  /** Digest of the installed implementation, not of model-authored prose. */
  digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  trust: z.enum(["experimental", "reviewed"]),
  review: namedReviewSchema.nullable(),
};

const environmentAdapterSchema = z
  .object({
    ...adapterBase,
    kind: z.literal("environment"),
    supports: z.array(z.enum(practiceEnvironmentKinds)).min(1).max(20),
    operations: z.array(operationSchema).max(40).default([]),
  })
  .strict();

const assessmentAdapterSchema = z
  .object({
    ...adapterBase,
    kind: z.literal("assessment"),
    supports: z.array(z.enum(practiceAssessmentKinds)).min(1).max(20),
    operations: z.tuple([]).default([]),
  })
  .strict();

/**
 * Installed implementation metadata. It contains bounded policy, never commands or model output.
 * The runtime resolves an operation id to reviewed code through its existing broker/executor.
 */
export const practiceAdapterManifestSchema = z
  .discriminatedUnion("kind", [environmentAdapterSchema, assessmentAdapterSchema])
  .superRefine((adapter, context) => {
    if (adapter.trust === "reviewed" && !adapter.review) {
      context.addIssue({
        code: "custom",
        path: ["review"],
        message: "A reviewed adapter must name who reviewed this version and when.",
      });
    }
    if (adapter.kind !== "environment") return;
    const ids = new Set(adapter.operations.map((operation) => operation.id));
    if (ids.size !== adapter.operations.length) {
      context.addIssue({
        code: "custom",
        path: ["operations"],
        message: "Operation ids must be unique within an adapter version.",
      });
    }
    for (const [index, operation] of adapter.operations.entries()) {
      for (const [field, referenced] of [
        ["rollbackOperationId", operation.rollbackOperationId],
        ["cleanupOperationId", operation.cleanupOperationId],
      ] as const) {
        if (referenced && !ids.has(referenced)) {
          context.addIssue({
            code: "custom",
            path: ["operations", index, field],
            message: `${field} must name another operation in this adapter version.`,
          });
        }
      }
    }
  });

export type PracticeAdapterManifest = z.infer<typeof practiceAdapterManifestSchema>;

const rehearsalStageSchema = z
  .object({
    stage: z.enum(["prepare", "precondition", "execute", "assess", "cleanup"]),
    verdict: z.enum(["pass", "fail", "unknown"]),
    seen: z.string().trim().min(1).max(400),
  })
  .strict();

/**
 * A release-quality receipt. This verifies that a pack version works in a known environment; it is
 * separate from the learner's achievement receipt and can never become career evidence.
 */
export const practiceReleaseCheckSchema = z
  .object({
    schemaVersion: z.literal(1),
    packId: z.string().trim().min(1).max(160),
    packVersion: z.string().trim().min(1).max(60),
    /** Digest of the canonical pack bytes; id/version alone cannot prove content did not change. */
    packDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    activityId: z.string().trim().min(1).max(160),
    verdict: z.enum(["pass", "fail", "unknown"]),
    adapterDigests: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(120),
            version: z.string().trim().min(1).max(40),
            digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
          })
          .strict()
      )
      .max(40),
    environmentFingerprint: z.string().trim().min(1).max(1000),
    stages: z.array(rehearsalStageSchema).min(1).max(20),
    verifiedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((check, context) => {
    const stages = new Map(check.stages.map((stage) => [stage.stage, stage.verdict]));
    if (stages.size !== check.stages.length) {
      context.addIssue({
        code: "custom",
        path: ["stages"],
        message: "A release check may record each stage once.",
      });
    }
    if (check.verdict === "pass") {
      for (const required of ["prepare", "execute", "assess", "cleanup"] as const) {
        if (stages.get(required) === "pass") continue;
        context.addIssue({
          code: "custom",
          path: ["stages"],
          message: `A passing release check needs a passing ${required} stage.`,
        });
      }
      const nonPassing = check.stages.find((stage) => stage.verdict !== "pass");
      if (nonPassing) {
        context.addIssue({
          code: "custom",
          path: ["stages"],
          message: `A passing release check cannot contain a ${nonPassing.verdict} stage.`,
        });
      }
    }
    if (new Date(check.expiresAt).getTime() <= new Date(check.verifiedAt).getTime()) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "A release check must expire after it was performed.",
      });
    }
    const adapterKeys = check.adapterDigests.map((item) => `${item.id}@${item.version}`);
    if (new Set(adapterKeys).size !== adapterKeys.length) {
      context.addIssue({
        code: "custom",
        path: ["adapterDigests"],
        message: "A release check may bind each adapter version once.",
      });
    }
  });

export type PracticeReleaseCheck = z.infer<typeof practiceReleaseCheckSchema>;

export type PracticeReleaseContext = {
  adapters: unknown[];
  checks: unknown[];
  /** Digest computed by the trusted pack loader from the canonical bytes it evaluated. */
  packDigest?: string;
  /** When supplied, only a rehearsal of the current environment can make an activity recommendable. */
  environmentFingerprint?: string;
  now?: Date;
};

export function adapterSupports(
  adapter: PracticeAdapterManifest,
  kind: PracticeEnvironmentKind | PracticeAssessmentKind
): boolean {
  return (adapter.supports as readonly string[]).includes(kind);
}
