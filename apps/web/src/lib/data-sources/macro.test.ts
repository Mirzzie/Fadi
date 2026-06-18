import { describe, expect, it } from "vitest";

import {
  computeYoY,
  inflationReading,
  parseObservations,
  rateReading,
  unemploymentReading,
} from "./macro";

describe("parseObservations", () => {
  it("drops missing values and coerces to numbers", () => {
    const out = parseObservations({
      observations: [
        { date: "2026-05-01", value: "320.5" },
        { date: "2026-04-01", value: "." }, // missing → dropped
        { date: "2026-03-01", value: "319.0" },
      ],
    });
    expect(out).toEqual([
      { date: "2026-05-01", value: 320.5 },
      { date: "2026-03-01", value: 319.0 },
    ]);
  });
});

describe("computeYoY", () => {
  it("returns null without a full year of data", () => {
    expect(computeYoY([{ date: "x", value: 100 }])).toBeNull();
  });

  it("computes year-over-year from a desc series (newest first)", () => {
    const obs = Array.from({ length: 13 }, (_, i) => ({ date: `m${i}`, value: 100 + (12 - i) }));
    // newest (index 0) = 112, year-ago (index 12) = 100 → +12%
    expect(computeYoY(obs)).toBeCloseTo(12);
  });
});

describe("macro readings always end in a controllable move", () => {
  it("inflation: hot inflation pushes pay re-benchmarking", () => {
    const r = inflationReading(6.2);
    expect(r.value).toBe("6.2%");
    expect(r.reading).toMatch(/climbing fast/i);
    expect(r.move).toMatch(/negotiat|re-benchmark/i);
  });

  it("rate: high rates steer targeting", () => {
    const r = rateReading(5.25);
    expect(r.value).toBe("5.25%");
    expect(r.move).toMatch(/targeting|cash-flow|options/i);
  });

  it("unemployment: a slack market normalizes longer searches + referrals", () => {
    const slack = unemploymentReading(7);
    expect(slack.reading).toMatch(/slack|not a verdict/i);
    expect(slack.move).toMatch(/referrals/i);
    const tight = unemploymentReading(3.5);
    expect(tight.reading).toMatch(/leverage/i);
  });
});
