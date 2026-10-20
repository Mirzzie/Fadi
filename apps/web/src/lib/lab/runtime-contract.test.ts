import { describe, expect, it } from "vitest";

import {
  canTransitionRuntime,
  observedProgressPercent,
  reachableSurface,
  runtimeIsReady,
  runtimeMessage,
  type LabRuntime,
} from "./runtime-contract";

function runtime(patch: Partial<LabRuntime> = {}): LabRuntime {
  return {
    id: "runtime-1",
    runId: "run-1",
    resourceId: "resource-1",
    phase: "queued",
    phaseDetail: null,
    progress: null,
    endpoints: [],
    readinessChecks: [],
    updatedAt: "2026-09-11T18:00:00.000Z",
    ...patch,
  };
}

describe("lab runtime contract", () => {
  it("allows an installation console to be reachable without calling the lab ready", () => {
    const installing = runtime({
      phase: "installing",
      endpoints: [
        { id: "viewer", kind: "viewer", state: "reachable", sessionPath: "/lab/runtime-1/viewer" },
      ],
      readinessChecks: [
        {
          id: "rdp",
          name: "Remote Desktop accepts connections",
          required: true,
          status: "pending",
          observedAt: null,
          detail: null,
        },
      ],
    });

    expect(reachableSurface(installing)?.kind).toBe("viewer");
    expect(runtimeIsReady(installing)).toBe(false);
    expect(runtimeMessage(installing)).toContain("still preparing");
  });

  it("requires at least one passed required check as well as the ready phase", () => {
    expect(runtimeIsReady(runtime({ phase: "ready" }))).toBe(false);
    expect(
      runtimeIsReady(
        runtime({
          phase: "ready",
          readinessChecks: [
            {
              id: "guest",
              name: "Guest health",
              required: true,
              status: "passed",
              observedAt: "2026-09-11T18:10:00.000Z",
              detail: "ok",
            },
          ],
        })
      )
    ).toBe(true);
  });

  it("shows only observed progress and never invents it from time", () => {
    expect(observedProgressPercent(null)).toBeNull();
    expect(observedProgressPercent({ unit: "bytes", completed: 20, total: 80 })).toBe(25);
    expect(observedProgressPercent({ unit: "bytes", completed: 120, total: 80 })).toBe(100);
  });

  it("rejects lifecycle jumps that bypass preparation", () => {
    expect(canTransitionRuntime("queued", "ready")).toBe(false);
    expect(canTransitionRuntime("queued", "pulling")).toBe(true);
    expect(canTransitionRuntime("installing", "awaiting_input")).toBe(true);
    expect(canTransitionRuntime("stopping", "stopped")).toBe(true);
  });
});
