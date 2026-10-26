import {
  type CapabilityManifest,
  type CapabilitySurfaceDescriptor,
  type EventRejection,
  type SurfaceAction,
  type SurfaceEventV1,
  type SurfaceRegion,
  validateEvent,
} from "./manifest";

/**
 * PHASE 3 PROOF (ADR 0016): one domain-neutral Practice capability serves two unlike careers from
 * the same templates, kernel and rubric — the DOMAIN comes from a versioned activity ref, never a
 * profession keyword. This is the contract + fixtures only; the runtime that emits these descriptors
 * is built after Phase 0 and Codex's shell catalogue/server-action adapter land.
 */

/** One Practice capability for every domain. No `if (domain === "security")` anywhere. */
export const PRACTICE_CAPABILITY: CapabilityManifest = {
  id: "fadi.practice",
  version: "1.0.0",
  category: "learning",
  title: "Practice",
  instanceConfigSchemaRef: "fadi.practice.instanceConfig@1",
  dependencies: { capabilities: [], adapters: ["fadi.rubric@1"] },
  permissions: { required: ["practice.read_activity", "practice.write_attempt"], optional: ["practice.marking_check"] },
  outputs: { evidenceTypes: ["practice_receipt"] },
  resources: { maxAiCallsPerRun: 0, externalCostAllowed: false }, // marking stays person-initiated + metered
  lifecycle: { dataRetention: "user_controlled", supportsPause: true, supportsExport: true, supportsRemoval: true },
  templates: ["workspace", "tracker", "form", "reading"],
};

/** A Practice instance is just a versioned activity ref (+ whether its optional resources are shown). */
export type PracticeInstanceConfig = {
  instanceId: string;
  packId: string;
  packVersion: string;
  activityId: string;
  optionalResources: boolean; // the ONLY intended cross-instance divergence for the proof
};

/** Two careers, configured — not branched. */
export const PRACTICE_INSTANCES: Record<"soc" | "cs", PracticeInstanceConfig> = {
  soc: {
    instanceId: "practice:soc",
    packId: "fadi.security-operations",
    packVersion: "0.2.0",
    activityId: "suspicious-sign-ins",
    optionalResources: true, // includes the Entra resource guides
  },
  cs: {
    instanceId: "practice:cs",
    packId: "fadi.customer-success",
    packVersion: "0.2.0",
    activityId: "churn-review",
    optionalResources: false, // omits optional resources
  },
};

/** Opaque registry ref for a binding this instance/step exposes (resolved server-side by the kernel). */
const ref = (c: PracticeInstanceConfig, name: string) => `practice:${c.activityId}:${name}`;

/**
 * Build the `workspace` descriptor for one step. Pure: real step data arrives through the bindings at
 * runtime. The soc/cs descriptors are identical except for the optional resource region — proving the
 * two careers diverge by CONFIG, not code, and never by grading/completion.
 */
export function practiceWorkspaceDescriptor(
  c: PracticeInstanceConfig,
  step: { id: string; title: string; index: number; total: number },
  rev: { descriptorRevision: string; instanceRevision: string; policyVersion: string; workItemId?: string }
): CapabilitySurfaceDescriptor {
  const regions: SurfaceRegion[] = [
    { id: "brief", kind: "text", bindingRef: ref(c, `${step.id}.brief`) },
  ];
  const bindings: CapabilitySurfaceDescriptor["dataBindings"] = [
    { ref: ref(c, `${step.id}.brief`), schemaRef: "fadi.practice.brief@1", scope: "capability" },
    { ref: ref(c, `${step.id}.answer`), schemaRef: "fadi.rubric.answer@1", scope: "capability" },
    { ref: ref(c, "progress"), schemaRef: "fadi.practice.progress@1", scope: "capability" },
  ];
  const actions: SurfaceAction[] = [
    { id: "submit_attempt", label: "Submit", kind: "fill", inputSchemaRef: "fadi.rubric.answer@1", requiresApproval: false, primary: true },
    { id: "request_marking_check", label: "Check my work", kind: "record" }, // person-started, metered
    { id: "open_step", label: "Open step", kind: "open" },
  ];

  if (c.optionalResources) {
    regions.push({ id: "resources", kind: "resource_links", bindingRef: ref(c, "resources") });
    bindings.push({ ref: ref(c, "resources"), schemaRef: "fadi.practice.resources@1", scope: "capability" });
    actions.push({ id: "open_resource", label: "Open resource", kind: "open" });
  }

  regions.push(
    { id: "answer", kind: "input", bindingRef: ref(c, `${step.id}.answer`), config: { inputSchemaRef: "fadi.rubric.answer@1" } },
    { id: "progress", kind: "progress", bindingRef: ref(c, "progress"), config: { total: step.total } }
  );

  return {
    descriptorVersion: 1,
    identity: {
      surfaceId: `${c.instanceId}:${step.id}`,
      descriptorRevision: rev.descriptorRevision,
      instanceId: c.instanceId,
      instanceRevision: rev.instanceRevision,
      definitionVersion: PRACTICE_CAPABILITY.version,
      templateId: "workspace",
      templateVersion: "1",
      policyVersion: rev.policyVersion,
      workItemId: rev.workItemId,
    },
    state: "active",
    outcome: { title: step.title, goalRef: `practice:${c.activityId}` },
    surface: { template: "workspace", regions },
    actions,
    nextAction: { actionId: "submit_attempt" },
    help: { summaryRef: `practice:${c.activityId}.help`, explainRef: `practice:${c.activityId}.explain` },
    completion: { reviewRef: `practice:${c.activityId}.completion` },
    dataBindings: bindings,
  };
}

// ── Action → work-engine intent mapping ──────────────────────────────────────────────────────────
/**
 * The dynamic half of the seam: a validated surface event resolved to a typed intent against the
 * EXISTING Practice work engine + evidence flow — NOT a new store. Codex's server-action adapter
 * dispatches each intent to the real path (see the mapping doc). This resolver is pure: it performs
 * no I/O, grants no permission, and never executes; it only decides WHICH existing capability an
 * action maps to, after the generic `validateEvent` gate.
 */
export type ActivityRef = { packId: string; activityId: string };

export type WorkEngineIntent =
  /** → existing Practice step-attempt write (work run-plan + rubric.composeAnswer), yields a practice_receipt via the evidence gate. */
  | { kind: "write_attempt"; instanceId: string; activityRef: ActivityRef; stepId: string; inputSchemaRef: string; payload: unknown }
  /** → existing person-started, metered marking (grader-check `checkGrader`; the resumable MARKING_TASK after Phase 0). Never scheduled, never silent AI spend. */
  | { kind: "request_marking_check"; instanceId: string; activityRef: ActivityRef; personStarted: true; providerMetered: true }
  /** → read-only navigation; opens nothing consequential. */
  | { kind: "navigate"; instanceId: string; target: { kind: "step" | "resource" } };

export type PracticeActionResult =
  | { ok: true; intent: WorkEngineIntent }
  | ({ ok: false } & EventRejection)
  | { ok: false; reason: "unsupported_action"; message: string };

/** stepId is the last segment of the surfaceId `<instanceId>:<stepId>`. */
function stepIdOf(descriptor: CapabilitySurfaceDescriptor): string {
  const parts = descriptor.identity.surfaceId.split(":");
  return parts[parts.length - 1] ?? "";
}

export function resolvePracticeAction(
  instance: PracticeInstanceConfig,
  descriptor: CapabilitySurfaceDescriptor,
  event: SurfaceEventV1
): PracticeActionResult {
  const checked = validateEvent(descriptor, event);
  if (!checked.ok) return checked;
  const activityRef: ActivityRef = { packId: instance.packId, activityId: instance.activityId };

  switch (event.actionId) {
    case "submit_attempt":
      return {
        ok: true,
        intent: {
          kind: "write_attempt",
          instanceId: instance.instanceId,
          activityRef,
          stepId: stepIdOf(descriptor),
          inputSchemaRef: checked.action.inputSchemaRef ?? "fadi.rubric.answer@1",
          payload: event.payload,
        },
      };
    case "request_marking_check":
      return {
        ok: true,
        intent: { kind: "request_marking_check", instanceId: instance.instanceId, activityRef, personStarted: true, providerMetered: true },
      };
    case "open_step":
      return { ok: true, intent: { kind: "navigate", instanceId: instance.instanceId, target: { kind: "step" } } };
    case "open_resource":
      return { ok: true, intent: { kind: "navigate", instanceId: instance.instanceId, target: { kind: "resource" } } };
    default:
      return { ok: false, reason: "unsupported_action", message: `'${event.actionId}' has no Practice work-engine mapping` };
  }
}
