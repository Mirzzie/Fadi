import { describe, expect, it } from "vitest";

import type { CapabilitySurfaceDescriptor, SurfaceEventV1 } from "./manifest";
import { PRACTICE_INSTANCES, practiceWorkspaceDescriptor, resolvePracticeAction } from "./practice-capability";

/**
 * The action→work-engine intent resolver: a validated surface event maps to a typed intent against
 * the EXISTING Practice paths (attempt write, person-started marking, navigation) — pure, no I/O,
 * stale/undeclared protected. Codex's server-action adapter dispatches the intents.
 */

const REV = { descriptorRevision: "d1", instanceRevision: "i1", policyVersion: "p1" };
const d = () => practiceWorkspaceDescriptor(PRACTICE_INSTANCES.soc, { id: "triage", title: "Triage", index: 0, total: 3 }, REV);

function ev(
  descriptor: CapabilitySurfaceDescriptor,
  actionId: string,
  opts: { payload?: unknown; via?: SurfaceEventV1["via"]; dRev?: string; iRev?: string } = {}
): SurfaceEventV1 {
  return {
    eventVersion: 1,
    eventId: "e1",
    surfaceId: descriptor.identity.surfaceId,
    expectedDescriptorRevision: opts.dRev ?? descriptor.identity.descriptorRevision,
    expectedInstanceRevision: opts.iRev ?? descriptor.identity.instanceRevision,
    instanceId: descriptor.identity.instanceId,
    actionId,
    payload: opts.payload,
    via: opts.via ?? "direct",
  };
}

describe("resolvePracticeAction", () => {
  it("maps submit_attempt to a write_attempt intent with the right step/activity/payload", () => {
    const r = resolvePracticeAction(PRACTICE_INSTANCES.soc, d(), ev(d(), "submit_attempt", { payload: { text: "my triage note" } }));
    expect(r.ok).toBe(true);
    if (r.ok && r.intent.kind === "write_attempt") {
      expect(r.intent.stepId).toBe("triage");
      expect(r.intent.activityRef).toEqual({ packId: "fadi.security-operations", activityId: "suspicious-sign-ins" });
      expect(r.intent.inputSchemaRef).toBe("fadi.rubric.answer@1");
      expect(r.intent.payload).toEqual({ text: "my triage note" });
    } else expect.fail("expected write_attempt");
  });

  it("maps request_marking_check to a person-started, metered marking intent", () => {
    const r = resolvePracticeAction(PRACTICE_INSTANCES.soc, d(), ev(d(), "request_marking_check", { payload: {} }));
    expect(r.ok).toBe(true);
    if (r.ok && r.intent.kind === "request_marking_check") {
      expect(r.intent.personStarted).toBe(true);
      expect(r.intent.providerMetered).toBe(true);
    } else expect.fail("expected request_marking_check");
  });

  it("maps open_step and open_resource to read-only navigation", () => {
    expect(resolvePracticeAction(PRACTICE_INSTANCES.soc, d(), ev(d(), "open_step"))).toMatchObject({ ok: true, intent: { kind: "navigate", target: { kind: "step" } } });
    expect(resolvePracticeAction(PRACTICE_INSTANCES.soc, d(), ev(d(), "open_resource"))).toMatchObject({ ok: true, intent: { kind: "navigate", target: { kind: "resource" } } });
  });

  it("treats voice as audit context only — same action, same intent", () => {
    const direct = resolvePracticeAction(PRACTICE_INSTANCES.soc, d(), ev(d(), "submit_attempt", { payload: { text: "x" }, via: "direct" }));
    const voice = resolvePracticeAction(PRACTICE_INSTANCES.soc, d(), ev(d(), "submit_attempt", { payload: { text: "x" }, via: "voice" }));
    expect(direct).toEqual(voice);
  });

  it("rejects an undeclared action", () => {
    expect(resolvePracticeAction(PRACTICE_INSTANCES.soc, d(), ev(d(), "delete_everything", { payload: {} }))).toMatchObject({ ok: false, reason: "undeclared_action" });
  });

  it("rejects a stale descriptor or instance revision (re-fetch)", () => {
    expect(resolvePracticeAction(PRACTICE_INSTANCES.soc, d(), ev(d(), "submit_attempt", { payload: {}, dRev: "old" }))).toMatchObject({ ok: false, reason: "stale_descriptor" });
    expect(resolvePracticeAction(PRACTICE_INSTANCES.soc, d(), ev(d(), "submit_attempt", { payload: {}, iRev: "old" }))).toMatchObject({ ok: false, reason: "stale_instance" });
  });

  it("rejects submit_attempt with no payload", () => {
    expect(resolvePracticeAction(PRACTICE_INSTANCES.soc, d(), ev(d(), "submit_attempt"))).toMatchObject({ ok: false, reason: "missing_payload" });
  });

  it("flags a declared action it has no mapping for", () => {
    const desc = d();
    desc.actions.push({ id: "weird", label: "Weird", kind: "open" });
    const r = resolvePracticeAction(PRACTICE_INSTANCES.soc, desc, ev(desc, "weird"));
    expect(r).toMatchObject({ ok: false, reason: "unsupported_action" });
  });

  it("the CS instance resolves on the same paths (no profession branch)", () => {
    const csD = practiceWorkspaceDescriptor(PRACTICE_INSTANCES.cs, { id: "diagnose", title: "Find at-risk", index: 0, total: 3 }, REV);
    const r = resolvePracticeAction(PRACTICE_INSTANCES.cs, csD, ev(csD, "submit_attempt", { payload: { text: "plan" } }));
    expect(r.ok).toBe(true);
    if (r.ok && r.intent.kind === "write_attempt") expect(r.intent.activityRef.activityId).toBe("churn-review");
  });
});
