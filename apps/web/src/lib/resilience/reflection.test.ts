import { describe, expect, it } from "vitest";

import { bucketWeeklyMotion, moraleRead, pastSelfStanding, type EventLite } from "./reflection";

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

describe("bucketWeeklyMotion", () => {
  it("sums positive deltas into weekly buckets, newest last", () => {
    const events: EventLite[] = [
      { createdAt: daysAgo(0), momentumDelta: 12, kind: "quality_application" }, // this week
      { createdAt: daysAgo(2), momentumDelta: 10, kind: "rejection_autopsy" }, // this week
      { createdAt: daysAgo(9), momentumDelta: 18, kind: "referral_added" }, // last week
      { createdAt: daysAgo(2), momentumDelta: -3, kind: "decay" }, // negative ignored
    ];
    const b = bucketWeeklyMotion(events, new Date(), 4);
    expect(b[3]).toBe(22); // this week 12+10
    expect(b[2]).toBe(18); // last week
    expect(b.length).toBe(4);
  });
});

describe("pastSelfStanding", () => {
  it("is 'new' until there's enough baseline", () => {
    expect(pastSelfStanding([0, 0, 5]).trend).toBe("new"); // only 1 prior active week
    expect(pastSelfStanding([0, 0, 0, 0]).percentile).toBeNull();
  });

  it("ranks a strong week above the user's own past weeks", () => {
    // prior weeks 5,5,5,5 ; this week 20 → beats 100%
    const s = pastSelfStanding([5, 5, 5, 5, 20]);
    expect(s.percentile).toBe(100);
    expect(s.trend).toBe("up");
    expect(s.line).toMatch(/your best|past weeks/i);
  });

  it("treats a quiet current week honestly, not as failure", () => {
    const s = pastSelfStanding([10, 10, 10, 10, 0]);
    expect(s.trend).toBe("down");
    expect(s.line).toMatch(/restart|quiet/i);
  });
});

describe("moraleRead", () => {
  const base = { band: "building" as const, isResting: false, recentRejections: 0, recentAutopsies: 0, daysSinceLastAction: 1 };

  it("protects a rest window", () => {
    expect(moraleRead({ ...base, isResting: true }).state).toBe("quiet");
  });

  it("meets a hard stretch with warmth + the autopsy as the next step", () => {
    const r = moraleRead({ ...base, band: "warming", recentRejections: 3, recentAutopsies: 0, daysSinceLastAction: 2 });
    expect(r.state).toBe("struggling");
    expect(r.line).not.toMatch(/lazy|failure|behind/i);
    expect(r.nextStep).toMatch(/autopsy/i);
  });

  it("celebrates a strong process", () => {
    expect(moraleRead({ ...base, band: "peak" }).state).toBe("thriving");
  });

  it("nudges gently after a quiet gap", () => {
    expect(moraleRead({ ...base, daysSinceLastAction: 6 }).state).toBe("quiet");
  });
});
