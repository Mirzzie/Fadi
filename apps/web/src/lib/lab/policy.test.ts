import { describe, expect, it } from "vitest";

import {
  BREAKER_THRESHOLD,
  breakerState,
  isInsideWorkspace,
  policyFor,
  withinQuota,
} from "./policy";

/**
 * The policy engine decides how hard it is to do something irreversible on someone's own
 * machine. Every rule here is one a future edit could quietly weaken, so each is pinned by
 * the consequence it prevents rather than by its current value.
 */

describe("confirmation strength follows the damage, not the convenience", () => {
  it("a reversible container action is one click", () => {
    const p = policyFor({ blast: "container", reversibility: "reversible" });
    expect(p.confirm).toBe("click");
  });

  it("anything irreversible must be typed out", () => {
    // The difference between an action you chose and one you clicked past.
    expect(policyFor({ blast: "container", reversibility: "irreversible" }).confirm).toBe("type-name");
    expect(policyFor({ blast: "workspace", reversibility: "irreversible" }).confirm).toBe("type-name");
  });

  it("anything reaching past a container must be typed out, even if reversible", () => {
    for (const blast of ["vm", "host", "remote"] as const) {
      expect(policyFor({ blast, reversibility: "reversible" }).confirm).toBe("type-name");
    }
  });

  it("only an irreversible prompt has a deadline at all", () => {
    // This assertion changed after Codex's review, and the reason matters. The first
    // version expired every prompt in 3-10 minutes, which threw away the user's DECISION
    // because the CHECK had gone stale — two separate things. Freshness now lives where it
    // belongs, in a re-run of preflight at approval.
    //
    // A deadline still earns its place for exactly one job: bounding how long an
    // irreversible ask can lie in wait for an absent-minded click. Navigating away from a
    // page is not a decision, so everything reversible waits.
    const gone = policyFor({ blast: "host", reversibility: "irreversible" });
    const back = policyFor({ blast: "container", reversibility: "reversible" });
    const disruptive = policyFor({ blast: "container", reversibility: "disruptive" });

    expect(gone.ttlMinutes).toBeGreaterThan(0);
    expect(back.ttlMinutes).toBeNull();
    expect(disruptive.ttlMinutes).toBeNull();
  });

  it("irreversible actions have the tightest hourly ceiling", () => {
    const gone = policyFor({ blast: "host", reversibility: "irreversible" });
    const back = policyFor({ blast: "container", reversibility: "reversible" });
    expect(gone.perHour).toBeLessThan(back.perHour);
  });
});

describe("quotas", () => {
  const policy = policyFor({ blast: "container", reversibility: "reversible" });

  it("allows normal use", () => {
    expect(withinQuota({ policy, executedLastHour: 0 }).allowed).toBe(true);
    expect(withinQuota({ policy, executedLastHour: policy.perHour - 1 }).allowed).toBe(true);
  });

  it("refuses at the ceiling, and says nothing ran", () => {
    const res = withinQuota({ policy, executedLastHour: policy.perHour });
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toMatch(/nothing ran/i);
  });
});

describe("the circuit breaker", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  const ago = (mins: number) => new Date(now.getTime() - mins * 60_000);

  it("stays closed when nothing is wrong", () => {
    expect(breakerState([], now).tripped).toBe(false);
  });

  it("trips on a burst of machine denials", () => {
    const burst = Array.from({ length: BREAKER_THRESHOLD }, () => ({ actor: "model", createdAt: ago(1) }));
    const state = breakerState(burst, now);
    expect(state.tripped).toBe(true);
    if (state.tripped) expect(state.reason).toMatch(/nothing ran/i);
  });

  it("does NOT count a person declining prompts", () => {
    // Declining is the system working. Counting it would punish the behaviour the whole
    // design is trying to encourage.
    const declines = Array.from({ length: BREAKER_THRESHOLD + 3 }, () => ({
      actor: "user",
      createdAt: ago(1),
    }));
    expect(breakerState(declines, now).tripped).toBe(false);
  });

  it("only looks at the recent window", () => {
    const old = Array.from({ length: BREAKER_THRESHOLD + 5 }, () => ({
      actor: "model",
      createdAt: ago(60),
    }));
    expect(breakerState(old, now).tripped).toBe(false);
  });

  it("counts MCP clients and background agents too, not just the chat model", () => {
    const mixed = [
      ...Array.from({ length: 3 }, () => ({ actor: "mcp", createdAt: ago(1) })),
      ...Array.from({ length: 2 }, () => ({ actor: "agent", createdAt: ago(2) })),
    ];
    expect(breakerState(mixed, now).tripped).toBe(true);
  });
});

describe("the workspace is a jail, not a suggestion", () => {
  const root = "/home/me/fadi-labs";

  it("allows the root and anything under it", () => {
    expect(isInsideWorkspace(root, root)).toBe(true);
    expect(isInsideWorkspace(root + "/project/run.sh", root)).toBe(true);
  });

  it("refuses a sibling that merely shares the prefix", () => {
    // The classic off-by-one in every naive startsWith check.
    expect(isInsideWorkspace("/home/me/fadi-labs-old/secrets", root)).toBe(false);
    expect(isInsideWorkspace("/home/me/fadi-labsX", root)).toBe(false);
  });

  it("refuses anything outside", () => {
    for (const p of ["/etc/passwd", "/home/me/.ssh/id_rsa", "/", "/home/me"]) {
      expect(isInsideWorkspace(p, root)).toBe(false);
    }
  });

  it("refuses when there is no workspace configured", () => {
    // No root means no filesystem access at all, never "everything".
    expect(isInsideWorkspace("/anything", "")).toBe(false);
  });

  it("handles a trailing slash on the root", () => {
    expect(isInsideWorkspace(root + "/x", root + "/")).toBe(true);
    expect(isInsideWorkspace("/home/me/fadi-labs-old", root + "/")).toBe(false);
  });
});
