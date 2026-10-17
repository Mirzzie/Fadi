import { z } from "zod";

import { practiceActivitySchema, type PracticeActivity } from "./contract";

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
    | "credential_without_output";
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
export function evaluatePracticePack(input: unknown): PackEvaluation {
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
  return {
    valid,
    recommendable: valid && pack.trust === "reviewed",
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
