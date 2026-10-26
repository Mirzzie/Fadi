import { describe, expect, it } from "vitest";

import { activityRuntime } from "../practice/packs";
import { capabilityManifestSchema, validateDescriptor } from "./manifest";
import { PRACTICE_CAPABILITY, PRACTICE_INSTANCES, practiceWorkspaceDescriptor } from "./practice-capability";

/**
 * The Phase 3 proof: two unlike careers run on ONE capability/template/kernel, diverging only by
 * configuration (a versioned activity ref + whether optional resources show) — never by code, and
 * never in grading or completion.
 */

const REV = { descriptorRevision: "d1", instanceRevision: "i1", policyVersion: "p1" };
const socStep = { id: "triage", title: "Triage the alert", index: 0, total: 3 };
const csStep = { id: "diagnose", title: "Find the accounts at risk", index: 0, total: 3 };
const soc = () => practiceWorkspaceDescriptor(PRACTICE_INSTANCES.soc, socStep, REV);
const cs = () => practiceWorkspaceDescriptor(PRACTICE_INSTANCES.cs, csStep, REV);

describe("the capability definition", () => {
  it("is a valid manifest with no profession in it", () => {
    expect(capabilityManifestSchema.safeParse(PRACTICE_CAPABILITY).success).toBe(true);
    expect(JSON.stringify(PRACTICE_CAPABILITY).toLowerCase()).not.toMatch(/security|customer|nurse|cyber/);
    expect(PRACTICE_CAPABILITY.resources.maxAiCallsPerRun).toBe(0); // marking is person-started
  });
});

describe("two careers, one seam", () => {
  it("both instances produce valid descriptors", () => {
    expect(validateDescriptor(soc()).ok).toBe(true);
    expect(validateDescriptor(cs()).ok).toBe(true);
  });

  it("use the SAME template and kernel", () => {
    expect(soc().surface.template).toBe("workspace");
    expect(cs().surface.template).toBe("workspace");
    expect(soc().identity.definitionVersion).toBe(cs().identity.definitionVersion);
  });

  it("reference REAL installed activities at the configured version (not keyword branches)", () => {
    for (const c of [PRACTICE_INSTANCES.soc, PRACTICE_INSTANCES.cs]) {
      const rt = activityRuntime(c.packId, c.activityId);
      expect(rt, `${c.packId}/${c.activityId} must be installed`).toBeDefined();
      expect(rt!.pack.version).toBe(c.packVersion);
    }
  });

  it("diverge ONLY by the optional resources (config, not code)", () => {
    const socHasResources = soc().surface.regions.some((r) => r.kind === "resource_links");
    const csHasResources = cs().surface.regions.some((r) => r.kind === "resource_links");
    expect(socHasResources).toBe(true);
    expect(csHasResources).toBe(false);
    expect(soc().actions.some((a) => a.id === "open_resource")).toBe(true);
    expect(cs().actions.some((a) => a.id === "open_resource")).toBe(false);
  });

  it("keep grading and completion identical — personalisation never touches them", () => {
    const submit = (d: ReturnType<typeof soc>) => d.actions.find((a) => a.id === "submit_attempt");
    expect(submit(soc())).toEqual(submit(cs())); // same primary action + rubric input schema
    expect(soc().nextAction).toEqual(cs().nextAction);
    // completion refs follow the activity, and both go through the same rubric evidence path
    expect(soc().completion?.reviewRef).toBe("practice:suspicious-sign-ins.completion");
    expect(cs().completion?.reviewRef).toBe("practice:churn-review.completion");
    expect(PRACTICE_CAPABILITY.dependencies.adapters).toContain("fadi.rubric@1");
  });

  it("a tampered descriptor (injected content) fails closed", () => {
    const d = structuredClone(soc());
    (d.surface.regions[0] as { config?: Record<string, unknown> }).config = { note: "<script>steal()</script>" } as never;
    // text region config is strict (only maxChars) → parse fails; validateDescriptor reports not ok
    expect(validateDescriptor(d).ok).toBe(false);
  });
});
