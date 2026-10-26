import { describe, expect, it } from "vitest";

import {
  DESCRIPTOR_LIMITS,
  assertNoExecutableContent,
  surfaceDescriptorSchema,
  surfaceEventSchema,
  surfaceIdentitySchema,
  validateDescriptor,
} from "./manifest";
import { PRACTICE_INSTANCES, practiceWorkspaceDescriptor } from "./practice-capability";

const REV = { descriptorRevision: "d1", instanceRevision: "i1", policyVersion: "p1", workItemId: "w1" };
const base = () =>
  practiceWorkspaceDescriptor(PRACTICE_INSTANCES.soc, { id: "triage", title: "Triage the alert", index: 0, total: 3 }, REV);

describe("a well-formed descriptor", () => {
  it("validates and stays well under the size limit", () => {
    const r = validateDescriptor(base());
    expect(r.ok).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(base()), "utf8")).toBeLessThan(DESCRIPTOR_LIMITS.maxBytes);
  });
});

describe("fail closed on bad descriptors (Codex seam tests)", () => {
  it("rejects an unknown template", () => {
    const d = structuredClone(base()) as Record<string, unknown>;
    (d.surface as Record<string, unknown>).template = "dashboard";
    expect(surfaceDescriptorSchema.safeParse(d).success).toBe(false);
  });

  it("rejects a region kind not allowed in the template (reading can't take input)", () => {
    const d = structuredClone(base());
    d.surface.template = "reading";
    const r = validateDescriptor(d);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "region_not_in_template")).toBe(true);
  });

  it("rejects a `metrics` region (no model-made scores)", () => {
    const d = structuredClone(base()) as { surface: { regions: unknown[] } };
    d.surface.regions.push({ id: "m", kind: "metrics", bindingRef: "x" });
    expect(surfaceDescriptorSchema.safeParse(d).success).toBe(false);
  });

  it("rejects executable/remote content in a region config", () => {
    expect(() => assertNoExecutableContent({ html: "<script>x()</script>" })).toThrow();
    expect(() => assertNoExecutableContent({ note: "see https://evil.test" })).toThrow();
    const d = structuredClone(base());
    // inject a forbidden key into the input region's config
    (d.surface.regions.find((r) => r.id === "answer") as { config: Record<string, unknown> }).config.onClick = "doThing()";
    expect(surfaceDescriptorSchema.safeParse(d).success).toBe(false); // strict keys reject it at parse
  });

  it("rejects a binding/schema ref that is a URL or path", () => {
    const d = structuredClone(base());
    d.dataBindings[0].ref = "https://evil.test/data";
    expect(surfaceDescriptorSchema.safeParse(d).success).toBe(false);
  });

  it("flags more than one primary action", () => {
    const d = structuredClone(base());
    d.actions[1].primary = true;
    const r = validateDescriptor(d);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "multiple_primary")).toBe(true);
  });

  it("flags a nextAction that isn't in the action catalogue", () => {
    const d = structuredClone(base());
    d.nextAction = { actionId: "delete_everything" };
    const r = validateDescriptor(d);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "undeclared_action")).toBe(true);
  });

  it("flags a region bound to a ref not declared in dataBindings", () => {
    const d = structuredClone(base());
    d.surface.regions[0].bindingRef = "practice:ghost";
    const r = validateDescriptor(d);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "unbound_region")).toBe(true);
  });

  it("rejects more declared actions than the limit", () => {
    const d = structuredClone(base());
    d.actions = Array.from({ length: DESCRIPTOR_LIMITS.maxActions + 1 }, (_, i) => ({
      id: `a${i}`,
      label: "x",
      kind: "open" as const,
    }));
    expect(surfaceDescriptorSchema.safeParse(d).success).toBe(false);
  });
});

describe("identity and event shapes", () => {
  it("accept valid shapes and reject unknown keys (strict)", () => {
    expect(surfaceIdentitySchema.safeParse(base().identity).success).toBe(true);
    const ev = {
      eventVersion: 1 as const,
      eventId: "e1",
      surfaceId: "s",
      expectedDescriptorRevision: "d1",
      expectedInstanceRevision: "i1",
      instanceId: "practice:soc",
      actionId: "submit_attempt",
      via: "voice" as const,
    };
    expect(surfaceEventSchema.safeParse(ev).success).toBe(true);
    expect(surfaceEventSchema.safeParse({ ...ev, sneaky: true }).success).toBe(false);
  });
});
