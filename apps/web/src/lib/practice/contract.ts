import { z } from "zod";

/**
 * The portable description of practical work.
 *
 * A machine is one possible environment. Keeping the environment, assessment and output
 * independent lets the same work journey represent a VM exercise, a document reviewed against a
 * rubric, a role-play, a third-party course or supervised physical work without pretending that
 * all of them are shell commands.
 *
 * This is a boundary contract, not a second persistence model. Existing project runs are exposed
 * through this shape while their tables are migrated in place (ADR 0014).
 */

export const practiceEnvironmentKinds = [
  "unspecified",
  "none",
  "browser",
  "document",
  "conversation",
  "external_tool",
  "simulation",
  "local_workspace",
  "managed_lab",
  "container",
  "virtual_machine",
  "physical_world",
] as const;

export const practiceAssessmentKinds = [
  "machine_predicate",
  "submission",
  "rubric",
  "scenario_outcome",
  "external_credential",
  "reflection",
  "attestation",
] as const;

export const practiceOutputKinds = [
  "text",
  "file",
  "link",
  "media",
  "machine_receipt",
  "scenario_result",
  "credential",
  "supervisor_attestation",
] as const;

export type PracticeEnvironmentKind = (typeof practiceEnvironmentKinds)[number];
export type PracticeAssessmentKind = (typeof practiceAssessmentKinds)[number];
export type PracticeOutputKind = (typeof practiceOutputKinds)[number];

export const adapterRefSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    version: z.string().trim().min(1).max(40),
  })
  .strict();

export const practiceStepSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(160),
    instruction: z.string().trim().min(1).max(4000),
    environment: z
      .object({
        kind: z.enum(practiceEnvironmentKinds),
        adapter: adapterRefSchema.nullable().default(null),
      })
      .strict(),
    assessment: z
      .object({
        kind: z.enum(practiceAssessmentKinds),
        adapter: adapterRefSchema.nullable().default(null),
      })
      .strict(),
    outputs: z
      .array(
        z
          .object({
            kind: z.enum(practiceOutputKinds),
            required: z.boolean().default(true),
          })
          .strict()
      )
      .max(12)
      .default([]),
  })
  .strict();

export const practiceActivitySchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().trim().min(1).max(160),
    title: z.string().trim().min(1).max(200),
    outcome: z.string().trim().min(1).max(1200),
    competencies: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
    steps: z.array(practiceStepSchema).min(1).max(40),
  })
  .strict()
  .superRefine((activity, context) => {
    const seen = new Set<string>();
    for (const [index, step] of activity.steps.entries()) {
      if (seen.has(step.id)) {
        context.addIssue({
          code: "custom",
          path: ["steps", index, "id"],
          message: "Step ids must be unique within an activity.",
        });
      }
      seen.add(step.id);
    }
  });

export type PracticeActivity = z.infer<typeof practiceActivitySchema>;

/** Temporary compatibility at the old project-step boundary. Unknown values stay unknown. */
export function environmentForLegacyPlace(
  place: string | null | undefined
): PracticeEnvironmentKind {
  if (place === "lab") return "managed_lab";
  if (place === "browser") return "browser";
  if (place === "fadi") return "none";
  return "unspecified";
}

/** Setup performed by Fadi is part of the receipt, not a learner achievement. */
export function isFacilitatorPlace(place: string | null | undefined): boolean {
  return place === "fadi";
}
