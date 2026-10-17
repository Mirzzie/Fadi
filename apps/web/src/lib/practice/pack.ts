import { z } from "zod";

import {
  practiceActivitySchema,
  type PracticeActivity,
  type PracticeAssessmentKind,
  type PracticeEnvironmentKind,
} from "./contract";
import {
  adapterSupports,
  practiceAdapterManifestSchema,
  practiceReleaseCheckSchema,
  type PracticeAdapterManifest,
  type PracticeReleaseContext,
} from "./release";

const sourceSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    url: z.string().url().max(2000),
    /** ISO timestamp for when a maintainer last checked the source. */
    checkedAt: z.string().datetime({ offset: true }),
  })
  .strict();

const reviewSchema = z
  .object({
    reviewedBy: z.string().trim().min(1).max(160),
    reviewedAt: z.string().datetime({ offset: true }),
  })
  .strict();

/**
 * A distributable, versioned unit communities can maintain without forking Fadi's runtime.
 * Trust is explicit: an AI- or community-authored pack starts experimental and only a named
 * review can mark that exact version reviewed.
 */
export const practicePackSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().trim().min(1).max(160),
    version: z.string().trim().min(1).max(60),
    title: z.string().trim().min(1).max(200),
    domain: z
      .object({
        id: z.string().trim().min(1).max(120),
        label: z.string().trim().min(1).max(160),
      })
      .strict(),
    license: z.string().trim().min(1).max(120),
    trust: z.enum(["experimental", "reviewed"]),
    review: reviewSchema.nullable().default(null),
    sources: z.array(sourceSchema).max(30).default([]),
    activities: z.array(practiceActivitySchema).min(1).max(40),
  })
  .strict()
  .superRefine((pack, context) => {
    if (pack.trust === "reviewed" && !pack.review) {
      context.addIssue({
        code: "custom",
        path: ["review"],
        message: "A reviewed pack must name who reviewed this version and when.",
      });
    }
    const seen = new Set<string>();
    for (const [index, activity] of pack.activities.entries()) {
      if (seen.has(activity.id)) {
        context.addIssue({
          code: "custom",
          path: ["activities", index, "id"],
          message: "Activity ids must be unique within a pack.",
        });
      }
      seen.add(activity.id);
    }
  });

export type PracticePack = z.infer<typeof practicePackSchema>;

export type PackIssue = {
  severity: "error" | "warning";
  code:
    | "invalid_pack"
    | "experimental"
    | "missing_environment_adapter"
    | "missing_assessment_adapter"
    | "missing_required_output"
    | "credential_without_output"
    | "adapter_unavailable"
    | "adapter_registry_conflict"
    | "adapter_unreviewed"
    | "adapter_kind_mismatch"
    | "adapter_support_mismatch"
    | "release_check_missing"
    | "release_check_invalid"
    | "release_check_failed"
    | "release_check_expired"
    | "release_environment_mismatch"
    | "release_content_mismatch"
    | "release_adapter_mismatch";
  activityId: string | null;
  stepId: string | null;
  message: string;
};

export type PackEvaluation = {
  valid: boolean;
  /** Safe to offer normally rather than behind an Experimental label. */
  recommendable: boolean;
  issues: PackIssue[];
};

const ENVIRONMENTS_REQUIRING_ADAPTER = new Set([
  "external_tool",
  "simulation",
  "managed_lab",
  "container",
  "virtual_machine",
]);

const ASSESSMENTS_REQUIRING_ADAPTER = new Set([
  "machine_predicate",
  "rubric",
  "scenario_outcome",
  "external_credential",
]);

/**
 * Static pack checks. They establish that the declared implementation is complete; adapter test
 * runs still establish whether it works in reality. This separation prevents a valid JSON file
 * from being presented as a tested activity.
 */
export function evaluatePracticePack(
  input: unknown,
  release?: PracticeReleaseContext
): PackEvaluation {
  const parsed = practicePackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      recommendable: false,
      issues: [
        {
          severity: "error",
          code: "invalid_pack",
          activityId: null,
          stepId: null,
          message: parsed.error.issues[0]?.message ?? "The pack does not match schema version 1.",
        },
      ],
    };
  }

  const pack = parsed.data;
  const issues: PackIssue[] = [];
  if (pack.trust === "experimental") {
    issues.push({
      severity: "warning",
      code: "experimental",
      activityId: null,
      stepId: null,
      message: "This pack has not been reviewed for normal recommendations.",
    });
  }

  for (const activity of pack.activities) evaluateActivity(activity, issues);
  const valid = !issues.some((issue) => issue.severity === "error");
  if (valid && pack.trust === "reviewed") {
    evaluateRelease(pack, release, issues);
  }
  return {
    valid,
    recommendable: valid && pack.trust === "reviewed" && issues.length === 0,
    issues,
  };
}

function evaluateActivity(activity: PracticeActivity, issues: PackIssue[]) {
  for (const step of activity.steps) {
    if (ENVIRONMENTS_REQUIRING_ADAPTER.has(step.environment.kind) && !step.environment.adapter) {
      issues.push({
        severity: "error",
        code: "missing_environment_adapter",
        activityId: activity.id,
        stepId: step.id,
        message: `${step.environment.kind} needs a versioned environment adapter.`,
      });
    }
    if (ASSESSMENTS_REQUIRING_ADAPTER.has(step.assessment.kind) && !step.assessment.adapter) {
      issues.push({
        severity: "error",
        code: "missing_assessment_adapter",
        activityId: activity.id,
        stepId: step.id,
        message: `${step.assessment.kind} needs a versioned assessment adapter.`,
      });
    }
    if (!step.outputs.some((output) => output.required)) {
      issues.push({
        severity: "warning",
        code: "missing_required_output",
        activityId: activity.id,
        stepId: step.id,
        message: "The step has no required output to carry into its completion review.",
      });
    }
    if (
      step.assessment.kind === "external_credential" &&
      !step.outputs.some((output) => output.kind === "credential")
    ) {
      issues.push({
        severity: "error",
        code: "credential_without_output",
        activityId: activity.id,
        stepId: step.id,
        message: "An external credential assessment must declare a credential output.",
      });
    }
  }
}

function evaluateRelease(
  pack: PracticePack,
  release: PracticeReleaseContext | undefined,
  issues: PackIssue[]
) {
  const adapters = (release?.adapters ?? []).flatMap((input) => {
    const parsed = practiceAdapterManifestSchema.safeParse(input);
    return parsed.success ? [parsed.data] : [];
  });
  const checkResults = (release?.checks ?? []).map((input) => ({
    input,
    parsed: practiceReleaseCheckSchema.safeParse(input),
  }));
  const checks = checkResults.flatMap(({ parsed }) => {
    return parsed.success ? [parsed.data] : [];
  });
  const now = release?.now ?? new Date();

  for (const activity of pack.activities) {
    const required = requiredAdapters(activity);
    const installed = new Map<string, PracticeAdapterManifest>();
    for (const requirement of required) {
      const candidates = adapters.filter(
        (candidate) => candidate.id === requirement.id && candidate.version === requirement.version
      );
      if (candidates.length > 1) {
        runtimeIssue(
          issues,
          "adapter_registry_conflict",
          activity.id,
          requirement.stepId,
          `${requirement.id}@${requirement.version} is registered more than once.`
        );
        continue;
      }
      const adapter = candidates[0];
      if (!adapter) {
        runtimeIssue(
          issues,
          "adapter_unavailable",
          activity.id,
          requirement.stepId,
          `${requirement.id}@${requirement.version} is not installed.`
        );
        continue;
      }
      installed.set(`${adapter.id}@${adapter.version}`, adapter);
      if (adapter.trust !== "reviewed") {
        runtimeIssue(
          issues,
          "adapter_unreviewed",
          activity.id,
          requirement.stepId,
          `${adapter.id}@${adapter.version} has not been reviewed.`
        );
      }
      if (adapter.kind !== requirement.adapterKind) {
        runtimeIssue(
          issues,
          "adapter_kind_mismatch",
          activity.id,
          requirement.stepId,
          `${adapter.id}@${adapter.version} is not an ${requirement.adapterKind} adapter.`
        );
      } else if (!adapterSupports(adapter, requirement.supports)) {
        runtimeIssue(
          issues,
          "adapter_support_mismatch",
          activity.id,
          requirement.stepId,
          `${adapter.id}@${adapter.version} does not support ${requirement.supports}.`
        );
      }
    }

    const invalidMatching = checkResults.some(
      ({ input, parsed }) =>
        !parsed.success && checkIdentifies(input, pack.id, pack.version, activity.id)
    );
    if (invalidMatching) {
      runtimeIssue(
        issues,
        "release_check_invalid",
        activity.id,
        null,
        "Release evidence for this activity is malformed and cannot be trusted."
      );
      continue;
    }
    const matching = checks
      .filter(
        (check) =>
          check.packId === pack.id &&
          check.packVersion === pack.version &&
          check.activityId === activity.id
      )
      .sort((a, b) => Date.parse(b.verifiedAt) - Date.parse(a.verifiedAt))[0];
    if (!matching) {
      runtimeIssue(
        issues,
        "release_check_missing",
        activity.id,
        null,
        "This exact activity release has not passed an end-to-end rehearsal."
      );
      continue;
    }
    if (matching.verdict !== "pass") {
      runtimeIssue(
        issues,
        "release_check_failed",
        activity.id,
        null,
        `The latest release rehearsal concluded ${matching.verdict}.`
      );
    }
    if (!release?.packDigest || matching.packDigest !== release.packDigest) {
      runtimeIssue(
        issues,
        "release_content_mismatch",
        activity.id,
        null,
        "The rehearsal did not cover the exact pack content being evaluated."
      );
    }
    if (Date.parse(matching.expiresAt) <= now.getTime()) {
      runtimeIssue(
        issues,
        "release_check_expired",
        activity.id,
        null,
        "The release rehearsal is out of date."
      );
    }
    if (
      release?.environmentFingerprint &&
      matching.environmentFingerprint !== release.environmentFingerprint
    ) {
      runtimeIssue(
        issues,
        "release_environment_mismatch",
        activity.id,
        null,
        "The release was rehearsed in a different environment."
      );
    }
    for (const adapter of installed.values()) {
      const bound = matching.adapterDigests.some(
        (item) =>
          item.id === adapter.id &&
          item.version === adapter.version &&
          item.digest === adapter.digest
      );
      if (!bound) {
        runtimeIssue(
          issues,
          "release_adapter_mismatch",
          activity.id,
          null,
          `The rehearsal did not cover the installed ${adapter.id}@${adapter.version} implementation.`
        );
      }
    }
  }
}

function checkIdentifies(
  input: unknown,
  packId: string,
  packVersion: string,
  activityId: string
): boolean {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  return (
    value.packId === packId && value.packVersion === packVersion && value.activityId === activityId
  );
}

type AdapterRequirement = {
  id: string;
  version: string;
  adapterKind: "environment" | "assessment";
  supports: PracticeEnvironmentKind | PracticeAssessmentKind;
  stepId: string;
};

function requiredAdapters(activity: PracticeActivity): AdapterRequirement[] {
  const required = new Map<string, AdapterRequirement>();
  for (const step of activity.steps) {
    for (const item of [
      step.environment.adapter
        ? {
            ...step.environment.adapter,
            adapterKind: "environment" as const,
            supports: step.environment.kind,
            stepId: step.id,
          }
        : null,
      step.assessment.adapter
        ? {
            ...step.assessment.adapter,
            adapterKind: "assessment" as const,
            supports: step.assessment.kind,
            stepId: step.id,
          }
        : null,
    ]) {
      if (item) {
        required.set(`${item.adapterKind}:${item.id}@${item.version}:${item.supports}`, item);
      }
    }
  }
  return [...required.values()];
}

function runtimeIssue(
  issues: PackIssue[],
  code: PackIssue["code"],
  activityId: string,
  stepId: string | null,
  message: string
) {
  issues.push({ severity: "warning", code, activityId, stepId, message });
}
