import { describe, expect, it } from "vitest";

import { formatShiftsForPrompt, relevantShiftsFor, WORLD_SHIFTS } from "./world-shifts";

describe("WORLD_SHIFTS catalog", () => {
  it("every shift pairs pressure with agency — a positioning move and sources", () => {
    for (const shift of WORLD_SHIFTS) {
      expect(shift.positioningMove.length).toBeGreaterThan(20);
      expect(shift.sources.length).toBeGreaterThan(5);
      expect(shift.reviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("relevantShiftsFor", () => {
  it("surfaces pressure first for a pressured field", () => {
    const ranked = relevantShiftsFor("Customer Support Specialist", "customer support");
    expect(ranked[0].relation).toBe("pressure");
    expect(ranked[0].shift.id).toBe("ai_disruption");
  });

  it("surfaces tailwinds for a resilient field", () => {
    const ranked = relevantShiftsFor("Registered Nurse", "healthcare");
    expect(ranked[0].relation).toBe("tailwind");
  });

  it("works for non-tech fields (domain-agnostic mandate)", () => {
    const ranked = relevantShiftsFor("Hotel Manager", "hospitality");
    expect(ranked[0].relation).toBe("pressure");
    expect(ranked[0].shift.id).toBe("inflation_tight_money");
  });

  it("always returns the full catalog as context for unmatched fields", () => {
    const ranked = relevantShiftsFor("Falconer", null);
    expect(ranked).toHaveLength(WORLD_SHIFTS.length);
    expect(ranked.every((r) => r.relation === "context")).toBe(true);
  });
});

describe("formatShiftsForPrompt", () => {
  it("tags relations and caps the list", () => {
    const block = formatShiftsForPrompt(relevantShiftsFor("Registered Nurse", "healthcare"), 3);
    expect(block).toContain("TAILWIND FOR THIS USER'S FIELD");
    expect(block.split("\n")).toHaveLength(3);
  });
});
