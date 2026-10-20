import { describe, expect, it } from "vitest";

import { presentOpportunityFit } from "./presentation";

const base = {
  fieldRelated: true,
  matchReason: "Supported by your recorded work",
  matchScore: 75,
  onRole: true,
  overLevel: false,
};

describe("presentOpportunityFit", () => {
  it("uses decision labels instead of exposing an internal percentage", () => {
    expect(presentOpportunityFit(base).label).toBe("Strong evidence");
    expect(presentOpportunityFit({ ...base, matchScore: 55 }).label).toBe("Possible fit");
    expect(presentOpportunityFit({ ...base, matchScore: 20 }).label).toBe("Needs review");
  });

  it("lets hard context override the ranking score", () => {
    expect(presentOpportunityFit({ ...base, overLevel: true }).label).toBe("Experience gap");
    expect(
      presentOpportunityFit({ ...base, fieldRelated: false, onRole: false }).label
    ).toBe("Outside direction");
  });
});
