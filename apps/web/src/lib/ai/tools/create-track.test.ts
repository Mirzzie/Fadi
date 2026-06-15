import { describe, expect, it } from "vitest";

import { createTrackTool, validateTrackArgs } from "./create-track";

describe("create_career_track tool", () => {
  it("reports the missing required fields instead of creating a half-baked track", () => {
    const r = validateTrackArgs({ targetRole: "Data Analyst" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.missing).toContain("a short name for the direction");
      expect(r.missing).toContain("what you want from it (your goal)");
      expect(r.missing).not.toContain("the target role");
    }
  });

  it("accepts a complete payload and normalizes intent + optional fields", () => {
    const r = validateTrackArgs({
      label: "Break into Analytics",
      targetRole: "Data Analyst",
      careerGoal: "Move into analytics within 6 months",
      location: "  Dublin, Ireland  ",
      intent: "EXPLORATION",
      domain: "",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.location).toBe("Dublin, Ireland");
      expect(r.input.intent).toBe("exploration");
      expect(r.input.domain).toBeUndefined(); // empty string → omitted
    }
  });

  it("defaults an unknown intent to 'career'", () => {
    const r = validateTrackArgs({ label: "X", targetRole: "Y", careerGoal: "Z", intent: "nonsense" });
    expect(r.ok && r.input.intent).toBe("career");
  });

  it("exposes a well-formed tool spec", () => {
    expect(createTrackTool.name).toBe("create_career_track");
    expect((createTrackTool.parameters as { required: string[] }).required).toEqual([
      "label",
      "targetRole",
      "careerGoal",
    ]);
  });
});
