import { describe, expect, it } from "vitest";

import { evaluateApply, evaluateDeleteAllData } from "./guardian";

const base = { onRole: true, fieldRelated: false, overLevel: false, targetRole: "SOC Analyst", jobTitle: "SOC Analyst" };

describe("evaluateApply", () => {
  it("stays silent (ok) for an on-role, in-level application", () => {
    expect(evaluateApply(base).level).toBe("ok");
  });

  it("nudges (never blocks) on an over-level role", () => {
    const v = evaluateApply({ ...base, overLevel: true, jobTitle: "Staff Security Engineer" });
    expect(v.level).toBe("nudge");
    expect(v.detail).toContain("SOC Analyst");
  });

  it("nudges when the role is off the user's direction", () => {
    const v = evaluateApply({ ...base, onRole: false, fieldRelated: false, jobTitle: "Pastry Chef" });
    expect(v.level).toBe("nudge");
    expect(v.headline.toLowerCase()).toContain("off your");
  });

  it("gives a softer nudge for an adjacent same-field role", () => {
    const v = evaluateApply({ ...base, onRole: false, fieldRelated: true, jobTitle: "Security Engineer" });
    expect(v.level).toBe("nudge");
    expect(v.headline.toLowerCase()).toContain("adjacent");
  });

  it("falls back gracefully with no target role", () => {
    const v = evaluateApply({ ...base, onRole: false, fieldRelated: false, targetRole: null, jobTitle: "X" });
    expect(v.level).toBe("nudge");
    expect(v.detail).toContain("your target role");
  });
});

describe("evaluateDeleteAllData", () => {
  it("always confirms (irreversible) and names what's lost", () => {
    const v = evaluateDeleteAllData();
    expect(v.level).toBe("confirm");
    expect(v.detail.toLowerCase()).toContain("permanently");
  });
});
