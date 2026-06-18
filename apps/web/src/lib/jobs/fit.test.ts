import { describe, expect, it } from "vitest";

import {
  FIT_DIMENSIONS,
  FIT_FLOOR,
  overallScore,
  verdictFor,
  verdictReason,
  type FitDimensionId,
} from "./fit";

const scores = (over: Partial<Record<FitDimensionId, number>>): Record<FitDimensionId, number> => ({
  roleMatch: 0,
  seniorityFit: 0,
  domainFit: 0,
  trajectory: 0,
  logistics: 0,
  legitimacy: 0,
  ...over,
});

describe("fit weights", () => {
  it("dimension weights sum to 1", () => {
    expect(FIT_DIMENSIONS.reduce((a, d) => a + d.weight, 0)).toBeCloseTo(1);
  });
});

describe("overallScore", () => {
  it("is a weighted 0–5 average", () => {
    expect(overallScore(scores({ roleMatch: 5, seniorityFit: 5, domainFit: 5, trajectory: 5, logistics: 5, legitimacy: 5 }))).toBe(5);
    expect(overallScore(scores({}))).toBe(0);
  });

  it("weights roleMatch and trajectory most heavily", () => {
    const roleHeavy = overallScore(scores({ roleMatch: 5, trajectory: 5 })); // 0.30+0.20 = 0.50 * 5 = 2.5
    const logisticsHeavy = overallScore(scores({ logistics: 5, legitimacy: 5 })); // 0.10+0.10 = 0.20 * 5 = 1.0
    expect(roleHeavy).toBeGreaterThan(logisticsHeavy);
    expect(roleHeavy).toBeCloseTo(2.5);
  });

  it("clamps out-of-range scores", () => {
    expect(overallScore(scores({ roleMatch: 99, seniorityFit: 99, domainFit: 99, trajectory: 99, logistics: 99, legitimacy: 99 }))).toBe(5);
  });
});

describe("verdictFor / verdictReason", () => {
  it("bands apply / stretch / skip around the floor", () => {
    expect(verdictFor(4.2)).toBe("apply");
    expect(verdictFor(3.0)).toBe("stretch");
    expect(verdictFor(FIT_FLOOR)).toBe("stretch"); // floor is inclusive of stretch
    expect(verdictFor(2.0)).toBe("skip");
  });

  it("a skip verdict frames it as time saved, not failure", () => {
    expect(verdictReason("skip", 2.0)).toMatch(/skip|elsewhere|rarely convert/i);
  });

  it("an apply verdict says it clears the bar", () => {
    expect(verdictReason("apply", 4.1)).toMatch(/clears the bar|tailored/i);
  });
});
