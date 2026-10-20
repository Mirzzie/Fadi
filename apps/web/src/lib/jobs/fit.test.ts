import { describe, expect, it } from "vitest";

import {
  FIT_DIMENSIONS,
  FIT_FLOOR,
  eligibilityChecks,
  eligibilityFrom,
  gateReason,
  gatedVerdict,
  overallScore,
  relevanceScore,
  type FitDimensionId,
  verdictFor,
  verdictReason,
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

describe("eligibility is a gate, not a weight", () => {
  const perfect = { roleMatch: 5, seniorityFit: 5, domainFit: 5, trajectory: 5 };

  it("CODEX'S CASE: a perfect match cannot outvote a failed legitimacy check", () => {
    // Reproduced before the fix: these exact inputs returned 4.0/5 and "Strong fit —
    // worth a genuinely tailored application", recommending hours of work on a posting
    // the model itself had scored zero for legitimacy.
    const scores = { ...perfect, logistics: 0, legitimacy: 0 };
    const checks = eligibilityChecks(scores);
    const { verdict, blocking } = gatedVerdict(checks, relevanceScore(scores));

    expect(verdict).toBe("blocked");
    expect(blocking.map((b) => b.id).sort()).toEqual(["legitimacy", "logistics"]);
    expect(gateReason(verdict, blocking)).toMatch(/Relevance is not the question/);
  });

  it("relevance stays high — being ruled out is not the same as being a bad match", () => {
    // The number must not be quietly deflated to justify the block. The job may fit
    // perfectly and still be impossible or fake, and saying so honestly is the point.
    expect(relevanceScore({ ...perfect, logistics: 0, legitimacy: 0 })).toBe(5);
  });

  it("an unsure model asks a question rather than alleging fraud", () => {
    // A model rating legitimacy 0-5 expresses "looks like a scam" and "couldn't tell"
    // with similar low numbers. Only a clear low score fails; the middle asks.
    expect(eligibilityFrom(0)).toBe("fail");
    expect(eligibilityFrom(2)).toBe("unknown");
    expect(eligibilityFrom(4)).toBe("pass");
    expect(eligibilityFrom(undefined)).toBe("unknown");

    const scores = { ...perfect, logistics: 4, legitimacy: 2 };
    const { verdict } = gatedVerdict(eligibilityChecks(scores), relevanceScore(scores));
    expect(verdict).toBe("check");
  });

  it("ranks normally once both gates pass", () => {
    const scores = { ...perfect, logistics: 5, legitimacy: 5 };
    const { verdict, blocking } = gatedVerdict(eligibilityChecks(scores), relevanceScore(scores));

    expect(verdict).toBe("apply");
    expect(blocking).toEqual([]);
  });

  it("a weak match with clean gates is still just a weak match", () => {
    // The gate must not turn low relevance into "blocked" — that would hide an ordinary
    // judgement behind the language of a hard constraint.
    const scores = { roleMatch: 1, seniorityFit: 1, domainFit: 1, trajectory: 1, logistics: 5, legitimacy: 5 };
    const { verdict } = gatedVerdict(eligibilityChecks(scores), relevanceScore(scores));

    expect(verdict).toBe("skip");
  });

  it("legitimacy is never click-through; logistics can be", () => {
    // People relocate and negotiate. Nobody should be offered a button that dismisses
    // "this posting looks fake".
    const checks = eligibilityChecks({ ...perfect, logistics: 0, legitimacy: 0 });
    expect(checks.find((c) => c.id === "logistics")!.overridable).toBe(true);
    expect(checks.find((c) => c.id === "legitimacy")!.overridable).toBe(false);
  });

  it("every check carries a readable reason, blocking or not", () => {
    for (const s of [0, 2, 5]) {
      for (const c of eligibilityChecks({ ...perfect, logistics: s, legitimacy: s })) {
        expect(c.reason.trim().length).toBeGreaterThan(0);
        expect(c.reason).not.toMatch(/undefined|NaN/);
      }
    }
  });
});
