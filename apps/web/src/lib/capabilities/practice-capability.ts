import {
  type CapabilityManifest,
  type CapabilitySurfaceDescriptor,
  type SurfaceAction,
  type SurfaceRegion,
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
