import { describe, expect, it } from "vitest";

import { offTrackPatternFinding } from "./patterns";

describe("offTrackPatternFinding", () => {
  it("stays silent below the floor (fewer than 3 off-track)", () => {
    expect(offTrackPatternFinding({ offTrackCount: 2, savedTotal: 3, targetRole: "SOC Analyst" })).toBeNull();
  });

  it("stays silent when off-track saves aren't a majority", () => {
    // 3 off-track but 10 saved → not a pattern, just exploration.
    expect(offTrackPatternFinding({ offTrackCount: 3, savedTotal: 10, targetRole: "SOC Analyst" })).toBeNull();
  });

  it("speaks up on a genuine drift (≥3 and a majority)", () => {
    const f = offTrackPatternFinding({ offTrackCount: 4, savedTotal: 6, targetRole: "SOC Analyst" });
    expect(f).not.toBeNull();
    expect(f!.title).toContain("SOC Analyst");
    expect(f!.detail.toLowerCase()).toContain("evolving");
  });

  it("falls back gracefully with no target role", () => {
    const f = offTrackPatternFinding({ offTrackCount: 3, savedTotal: 4, targetRole: null });
    expect(f!.title).toContain("your target role");
  });
});
