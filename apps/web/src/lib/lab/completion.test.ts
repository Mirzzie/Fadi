import { describe, expect, it } from "vitest";

import {
  CHECK_DID_NOT_PASS,
  completionAfterCheck,
  completionFor,
  completionOf,
  evidencedSteps,
  runHonesty,
  stepCheckOf,
} from "./completion";

/**
 * THE BUG THIS PINS.
 *
 * Six steps ticked with nothing recorded, and the platform said "finishing this will fold
 * what you produced into your evidence". Nothing had been produced. That sentence is Fadi
 * making a claim about a person's life with nothing behind it.
 *
 * So the property under test is narrow and absolute: a step nobody can show does not count
 * as evidence, no matter how it is ticked, counted or displayed.
 */

const step = (over: Partial<Parameters<typeof completionOf>[0]> = {}) => ({
  status: "done",
  artifact: null,
  completion: null,
  ...over,
});

describe("a tick is not a result", () => {
  it("a done step with nothing recorded is attested, never evidenced", () => {
    expect(completionOf(step())).toBe("attested");
    expect(evidencedSteps([step()])).toHaveLength(0);
  });

  it("whitespace is not something to show", () => {
    expect(completionOf(step({ artifact: "   " }))).toBe("attested");
    expect(completionFor("   ")).toBe("attested");
    expect(completionFor(null)).toBe("attested");
  });

  it("a recorded artefact makes it evidenced", () => {
    expect(completionOf(step({ artifact: "~/labs/ad-lifecycle/provision.ps1" }))).toBe("evidenced");
    expect(completionFor("~/labs/x")).toBe("evidenced");
  });

  it("a pending step has no completion at all", () => {
    expect(completionOf(step({ status: "pending" }))).toBeNull();
    expect(completionOf(step({ status: "skipped" }))).toBeNull();
  });

  it("an explicitly stored kind wins over the derivation", () => {
    // A verified step keeps its standing even if the artefact text is empty — Fadi
    // checked the machine, which does not depend on the person writing anything down.
    expect(completionOf(step({ completion: "verified" }))).toBe("verified");
    // And a stored "attested" is not upgraded by an artefact appearing later without a
    // re-completion; the row says what it says.
    expect(completionOf(step({ completion: "attested", artifact: "something" }))).toBe("attested");
  });
});

describe("THE REPORTED BUG: six empty clicks", () => {
  const sixEmptyClicks = Array.from({ length: 6 }, () => step());

  it("counts as complete, and as no evidence whatsoever", () => {
    const h = runHonesty(sixEmptyClicks);
    expect(h.done).toBe(6);
    expect(h.complete).toBe(true);
    // The assertion that matters. Every step ticked, nothing showable.
    expect(h.evidenced).toBe(0);
    expect(h.canBecomeEvidence).toBe(false);
  });

  it("one recorded artefact changes what may be claimed — and only by one", () => {
    const mixed = [...sixEmptyClicks.slice(0, 5), step({ artifact: "repo: github.com/x/y" })];
    const h = runHonesty(mixed);
    expect(h.evidenced).toBe(1);
    expect(h.canBecomeEvidence).toBe(true);
    // Still not six. A single result does not launder the other five.
    expect(h.evidenced).not.toBe(h.done);
  });

  it("an empty run promises nothing", () => {
    const h = runHonesty([]);
    expect(h.complete).toBe(false);
    expect(h.canBecomeEvidence).toBe(false);
  });
});

describe("a step Fadi checked (Codex review, 16 Oct 2026)", () => {
  const failed = stepCheckOf({
    status: "executed",
    detail: `${CHECK_DID_NOT_PASS}: "Running" was not in the output (exit 1).`,
  });

  it("reads the broker's request as the check's state", () => {
    expect(failed.state).toBe("failed");
    expect(stepCheckOf({ status: "failed", detail: "Fadi couldn't sign in" }).state).toBe("failed");
    expect(stepCheckOf({ status: "pending", detail: null }).state).toBe("waiting");
    expect(
      stepCheckOf({ status: "executed", detail: 'Check passed: found "Running".' }).state
    ).toBe("passed");
    expect(stepCheckOf({ status: "denied", detail: null }).state).toBe("none");
    expect(stepCheckOf(null).state).toBe("none");
  });

  it("stays failed: Done is refused", () => {
    expect(completionAfterCheck(failed, "C:\\agent.msi", false)).toEqual({
      ok: false,
      reason: "check_failed",
    });
  });

  it("may go on without verification, but only ever as the person's word", () => {
    expect(completionAfterCheck(failed, "looks installed to me", true)).toEqual({
      ok: true,
      completion: "attested",
    });
  });

  it("waits for a check that hasn't run, unless the person goes on without it", () => {
    const waiting = stepCheckOf({ status: "approved", detail: null });
    expect(completionAfterCheck(waiting, null, false)).toMatchObject({
      ok: false,
      reason: "check_waiting",
    });
    expect(completionAfterCheck(waiting, null, true)).toEqual({ ok: true, completion: "attested" });
  });

  it("is unchanged for a step nobody checked", () => {
    const none = stepCheckOf(null);
    expect(completionAfterCheck(none, "C:\\Lab", false)).toEqual({
      ok: true,
      completion: "evidenced",
    });
    expect(completionAfterCheck(none, null, false)).toEqual({ ok: true, completion: "attested" });
  });
});
