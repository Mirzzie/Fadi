import { z } from "zod";

/**
 * CAPABILITY CONTRACTS (ADR 0016 §9 + Codex rendering response `dd4803a`).
 *
 * Pure, versioned, server-validatable types for the composable career environment. NO runtime, NO
 * UI, NO migration — this is the contract layer the shell (Codex) renders and the kernel enforces.
 * A capability declares WHAT to render (a typed descriptor + opaque data bindings); it never ships
 * UI/JS/CSS and never carries executable content. The shell renders only from approved templates.
 *
 * Boundaries pinned here (the statically checkable ones):
 * - approved template catalogue + per-template region kinds; `metrics` is NOT an initial region;
 * - strict per-region config (no unknown keys, no URLs/script/html/iframe/$ref/callbacks);
 * - descriptor limits (size, regions, bindings, actions, one primary, ≤50 rows);
 * - identity + event shapes carrying revisions and a replay-stable eventId.
 * Runtime-enforced rules (replay dedupe, permission re-resolution, kernel-owned approval recheck)
 * live in the server-action adapter, not here, and are called out where they apply.
 */

// ── Templates & region kinds (shell-owned catalogue; Phase 3 subset) ─────────────────────────────
export const TEMPLATES = ["workspace", "tracker", "form", "reading"] as const; // conversation/timeline templates not yet registered
export type TemplateId = (typeof TEMPLATES)[number];

export const REGION_KINDS = ["text", "input", "progress", "resource_links", "list", "table", "timeline"] as const;
export type RegionKind = (typeof REGION_KINDS)[number];
// `metrics` is deliberately absent: later metrics need typed units + provenance, never a model-made score.

/** Which region kinds each approved template may contain. */
export const TEMPLATE_REGIONS: Record<TemplateId, readonly RegionKind[]> = {
  workspace: ["text", "input", "progress", "resource_links", "list", "table", "timeline"],
  tracker: ["list", "table", "progress", "text", "resource_links"],
  form: ["input", "text", "progress"],
  reading: ["text", "resource_links"],
};

// ── Descriptor limits ────────────────────────────────────────────────────────────────────────────
export const DESCRIPTOR_LIMITS = {
  maxBytes: 64 * 1024,
  maxRegions: 12,
  maxBindings: 16,
  maxActions: 16,
  maxRowsPerPage: 50,
} as const;

// ── Opaque registry id: not a URL, path, SQL or callback ─────────────────────────────────────────
const registryRef = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9][a-z0-9._:@-]*$/i, "binding/schema refs are opaque registry ids, not URLs/paths");

/** Reject any executable/remote content smuggled into config (defence in depth beyond strict keys). */
const FORBIDDEN_KEYS = new Set([
  "href", "src", "url", "uri", "script", "html", "innerhtml", "style", "classname", "class",
  "$ref", "ref", "iframe", "onclick", "on", "callback", "eval", "import", "component", "render",
]);
const FORBIDDEN_VALUE = /(https?:|javascript:|data:|<\s*script|<\s*iframe|<\s*\/|\$\{|on\w+\s*=)/i;
export function assertNoExecutableContent(value: unknown, path = "config"): void {
  if (typeof value === "string") {
    if (FORBIDDEN_VALUE.test(value)) throw new Error(`forbidden content at ${path}: looks executable/remote`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoExecutableContent(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(k.toLowerCase())) throw new Error(`forbidden key at ${path}.${k}`);
      assertNoExecutableContent(v, `${path}.${k}`);
    }
  }
}
const safeConfig = z.record(z.string(), z.unknown()).refine(
  (c) => {
    try {
      assertNoExecutableContent(c);
      return true;
    } catch {
      return false;
    }
  },
  { message: "config carries forbidden executable/remote content" }
);

// ── Regions (discriminated by kind; strict keys; typed config) ───────────────────────────────────
const columnFormat = z.enum(["text", "number", "date", "datetime", "duration", "status", "percent"]);
const tableConfig = z
  .object({
    fields: z.array(z.object({ key: registryRef, label: z.string().max(80), format: columnFormat }).strict()).min(1).max(24),
    pageSize: z.number().int().positive().max(DESCRIPTOR_LIMITS.maxRowsPerPage).optional(),
  })
  .strict();

const baseRegion = { id: z.string().trim().min(1).max(64), bindingRef: registryRef };
export const surfaceRegionSchema = z.discriminatedUnion("kind", [
  z.object({ ...baseRegion, kind: z.literal("text"), config: z.object({ maxChars: z.number().int().positive().max(20_000).optional() }).strict().optional() }).strict(),
  z.object({ ...baseRegion, kind: z.literal("input"), config: z.object({ inputSchemaRef: registryRef }).strict() }).strict(),
  z.object({ ...baseRegion, kind: z.literal("progress"), config: z.object({ total: z.number().int().positive().max(100).optional() }).strict().optional() }).strict(),
  z.object({ ...baseRegion, kind: z.literal("resource_links"), config: z.object({ max: z.number().int().positive().max(20).optional() }).strict().optional() }).strict(),
  z.object({ ...baseRegion, kind: z.literal("list"), config: tableConfig }).strict(),
  z.object({ ...baseRegion, kind: z.literal("table"), config: tableConfig }).strict(),
  z.object({ ...baseRegion, kind: z.literal("timeline"), config: safeConfig.optional() }).strict(),
]);
export type SurfaceRegion = z.infer<typeof surfaceRegionSchema>;

// ── Actions ──────────────────────────────────────────────────────────────────────────────────────
export const surfaceActionSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    label: z.string().min(1).max(120),
    kind: z.enum(["fill", "review", "confirm", "open", "record", "converse"]),
    inputSchemaRef: registryRef.optional(),
    requiresApproval: z.boolean().optional(), // NB: kernel-owned; false can never DOWNGRADE policy at commit
    primary: z.boolean().optional(),
  })
  .strict();
export type SurfaceAction = z.infer<typeof surfaceActionSchema>;

// ── Identity & event (Codex SurfaceIdentityV1 / SurfaceEventV1) ──────────────────────────────────
export const surfaceIdentitySchema = z
  .object({
    surfaceId: z.string().min(1),
    descriptorRevision: z.string().min(1),
    instanceId: z.string().min(1),
    instanceRevision: z.string().min(1),
    definitionVersion: z.string().min(1),
    templateId: z.enum(TEMPLATES),
    templateVersion: z.string().min(1),
    policyVersion: z.string().min(1),
    workItemId: z.string().optional(),
  })
  .strict();
export type SurfaceIdentityV1 = z.infer<typeof surfaceIdentitySchema>;

export const surfaceEventSchema = z
  .object({
    eventVersion: z.literal(1),
    eventId: z.string().min(1), // stable across replay of the SAME intent (runtime dedupes per (tenant,eventId))
    surfaceId: z.string().min(1),
    expectedDescriptorRevision: z.string().min(1),
    expectedInstanceRevision: z.string().min(1),
    instanceId: z.string().min(1),
    actionId: z.string().min(1), // must be declared in the descriptor's action catalogue (server re-resolves)
    payload: z.unknown().optional(), // rejected unless the registered action schema accepts it
    via: z.enum(["direct", "voice", "text"]), // audit context only — never permission/approval proof
  })
  .strict();
export type SurfaceEventV1 = z.infer<typeof surfaceEventSchema>;

// ── The descriptor ───────────────────────────────────────────────────────────────────────────────
export const surfaceDescriptorSchema = z
  .object({
    descriptorVersion: z.literal(1),
    identity: surfaceIdentitySchema,
    state: z.enum(["active", "paused", "hidden", "archived", "installed"]),
    outcome: z.object({ title: z.string().min(1).max(160), goalRef: registryRef.optional() }).strict(),
    surface: z
      .object({
        template: z.enum(TEMPLATES),
        regions: z.array(surfaceRegionSchema).max(DESCRIPTOR_LIMITS.maxRegions),
      })
      .strict(),
    actions: z.array(surfaceActionSchema).max(DESCRIPTOR_LIMITS.maxActions),
    nextAction: z.object({ actionId: z.string().min(1) }).strict().optional(), // references the action catalogue
    help: z.object({ summaryRef: registryRef.optional(), explainRef: registryRef.optional() }).strict().optional(),
    completion: z.object({ reviewRef: registryRef }).strict().optional(),
    dataBindings: z
      .array(z.object({ ref: registryRef, schemaRef: registryRef, scope: z.enum(["capability", "shared"]) }).strict())
      .max(DESCRIPTOR_LIMITS.maxBindings),
  })
  .strict();
export type CapabilitySurfaceDescriptor = z.infer<typeof surfaceDescriptorSchema>;

export type DescriptorIssue = { code: string; message: string };

/**
 * Full validation: schema + cross-field invariants the shell relies on. Returns issues (fail closed:
 * any issue means do NOT render an executable surface — show the unsupported notice instead).
 */
export function validateDescriptor(input: unknown): { ok: boolean; issues: DescriptorIssue[]; value?: CapabilitySurfaceDescriptor } {
  const parsed = surfaceDescriptorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => ({ code: "schema", message: `${i.path.join(".")}: ${i.message}` })) };
  }
  const d = parsed.data;
  const issues: DescriptorIssue[] = [];
  const serialized = JSON.stringify(d);
  if (Buffer.byteLength(serialized, "utf8") > DESCRIPTOR_LIMITS.maxBytes)
    issues.push({ code: "too_large", message: `descriptor exceeds ${DESCRIPTOR_LIMITS.maxBytes} bytes` });

  // Regions must be allowed for this template.
  const allowed = new Set(TEMPLATE_REGIONS[d.surface.template]);
  for (const r of d.surface.regions)
    if (!allowed.has(r.kind)) issues.push({ code: "region_not_in_template", message: `region '${r.kind}' not allowed in template '${d.surface.template}'` });

  // At most one primary action; nextAction must name a declared action; region bindings must exist.
  if (d.actions.filter((a) => a.primary).length > 1) issues.push({ code: "multiple_primary", message: "more than one primary action" });
  const actionIds = new Set(d.actions.map((a) => a.id));
  if (d.nextAction && !actionIds.has(d.nextAction.actionId))
    issues.push({ code: "undeclared_action", message: `nextAction '${d.nextAction.actionId}' is not in the action catalogue` });
  const bindingRefs = new Set(d.dataBindings.map((b) => b.ref));
  for (const r of d.surface.regions)
    if (!bindingRefs.has(r.bindingRef)) issues.push({ code: "unbound_region", message: `region '${r.id}' binds '${r.bindingRef}', not declared in dataBindings` });

  // Defence in depth: no executable/remote content anywhere in region configs.
  try {
    for (const r of d.surface.regions) assertNoExecutableContent((r as { config?: unknown }).config, `region.${r.id}.config`);
  } catch (e) {
    issues.push({ code: "forbidden_content", message: e instanceof Error ? e.message : "forbidden content" });
  }

  return issues.length === 0 ? { ok: true, issues: [], value: d } : { ok: false, issues };
}

// ── Capability definition (manifest) ─────────────────────────────────────────────────────────────
export const capabilityManifestSchema = z
  .object({
    id: z.string().trim().min(1).max(160),
    version: z.string().trim().min(1).max(60),
    category: z.enum(["learning", "career", "research", "reflection", "custom"]),
    title: z.string().min(1).max(120),
    instanceConfigSchemaRef: registryRef,
    dependencies: z.object({ capabilities: z.array(registryRef), adapters: z.array(registryRef) }).strict(),
    permissions: z.object({ required: z.array(z.string()), optional: z.array(z.string()) }).strict(),
    outputs: z.object({ evidenceTypes: z.array(z.string()) }).strict(),
    resources: z.object({ maxAiCallsPerRun: z.number().int().min(0), externalCostAllowed: z.literal(false) }).strict(),
    lifecycle: z
      .object({
        dataRetention: z.literal("user_controlled"),
        supportsPause: z.literal(true),
        supportsExport: z.literal(true),
        supportsRemoval: z.literal(true),
      })
      .strict(),
    templates: z.array(z.enum(TEMPLATES)).min(1),
  })
  .strict();
export type CapabilityManifest = z.infer<typeof capabilityManifestSchema>;
