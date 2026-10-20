import { z } from "zod";

import { FADI_RUNTIME_STATES } from "./state";

export { FADI_STATE_LABEL, resolveFadiRuntimeState } from "./state";
export type { FadiRuntimeState } from "./state";

/**
 * The data every Fadi worker may use to understand one turn.
 *
 * IDs and route context only: career facts remain in their authoritative stores. The envelope is
 * deliberately bounded so a caller cannot smuggle a DOM, document, transcript or prompt into a
 * field that looks like context.
 */

export const SESSION_ENVELOPE_VERSION = 1 as const;
export const SESSION_ID_MAX_CHARS = 100;

const opaqueId = z.string().trim().min(1).max(100);
const entityRefSchema = z
  .object({
    type: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-z0-9_]*$/),
    id: z.string().trim().min(1).max(200),
  })
  .strict();

const dashboardPath = z
  .string()
  .trim()
  .min(1)
  .max(1_024)
  .refine(
    (value) => value === "/dashboard" || value.startsWith("/dashboard/"),
    "route must stay inside the signed-in Fadi dashboard"
  );

export const fadiStateSchema = z.enum(FADI_RUNTIME_STATES);

export const sessionEnvelopeSchema = z
  .object({
    version: z.literal(SESSION_ENVELOPE_VERSION),
    sessionId: opaqueId,
    correlationId: opaqueId,
    /** Set from authentication by the server, never accepted as career truth from a model. */
    userId: opaqueId,
    modality: z.enum(["screen", "text", "voice", "background", "a2a"]),
    state: fadiStateSchema,
    route: z
      .object({
        pathname: dashboardPath,
        /** Changes whenever the bounded screen snapshot changes. */
        revision: z.string().trim().min(1).max(100).nullable().default(null),
      })
      .strict(),
    activeGoalId: opaqueId.nullable().default(null),
    workItemId: opaqueId.nullable().default(null),
    directionId: opaqueId.nullable().default(null),
    entityRefs: z.array(entityRefSchema).max(16).default([]),
    policyVersion: z.string().trim().min(1).max(64),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type SessionEnvelope = z.infer<typeof sessionEnvelopeSchema>;

export function parseSessionEnvelope(value: unknown): SessionEnvelope {
  return sessionEnvelopeSchema.parse(value);
}

/**
 * What the screen worker may observe. `value` is intentionally absent: passwords, tokens and
 * free-form document text do not belong in ambient screen context. Names and descriptions are
 * presentation text from the current page and must remain marked untrusted.
 */
const observedElementSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    role: z.enum(["button", "link", "textbox", "tab", "dialog", "status", "heading"]),
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(280).nullable().default(null),
    disabled: z.boolean().default(false),
    selected: z.boolean().nullable().default(null),
  })
  .strict();

export const screenContextSchema = z
  .object({
    version: z.literal(1),
    route: dashboardPath,
    revision: z.string().trim().min(1).max(100),
    workItemId: opaqueId.nullable().default(null),
    /** Presentation text can inform navigation; it is never an instruction or a career fact. */
    trust: z.literal("untrusted_presentation"),
    elements: z.array(observedElementSchema).max(40),
  })
  .strict();

export type ScreenContext = z.infer<typeof screenContextSchema>;

/**
 * The complete UI mutation vocabulary. There is deliberately no arbitrary click, selector,
 * submit, approve, delete, script or external URL command. Consequential changes are capabilities
 * owned by the task executor and policy broker.
 */
const commandBase = z.object({
  commandId: opaqueId,
  expectedRevision: z.string().trim().min(1).max(100),
});

export const screenCommandSchema = z.discriminatedUnion("type", [
  commandBase
    .extend({
      type: z.literal("navigate"),
      href: dashboardPath,
    })
    .strict(),
  commandBase
    .extend({
      type: z.literal("open_entity"),
      entity: entityRefSchema,
    })
    .strict(),
  commandBase
    .extend({
      type: z.literal("focus_field"),
      fieldId: z.string().trim().min(1).max(120),
    })
    .strict(),
  commandBase
    .extend({
      type: z.literal("set_draft_value"),
      fieldId: z.string().trim().min(1).max(120),
      value: z.string().max(4_096),
    })
    .strict(),
  commandBase
    .extend({
      type: z.literal("show_output"),
      output: entityRefSchema,
    })
    .strict(),
]);

export type ScreenCommand = z.infer<typeof screenCommandSchema>;

export const screenCommandBatchSchema = z.array(screenCommandSchema).min(1).max(8);

export function parseScreenCommands(value: unknown): ScreenCommand[] {
  return screenCommandBatchSchema.parse(value);
}
