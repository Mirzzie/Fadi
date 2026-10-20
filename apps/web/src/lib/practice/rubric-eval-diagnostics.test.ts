import { describe, expect, it } from "vitest";

import { runRubricEval } from "./rubric-eval";

describe("grading diagnostics preserve the release gate", () => {
  it("still refuses a false pass when the grader supplies an explanation", async () => {
    const plain = await runRubricEval(async () => "pass");
    const detailed = await runRubricEval(async () => ({
      verdict: "pass",
      criteria: [{ id: "explanation", level: "meets", decidedBy: "model", feedback: "Credited." }],
    }));
    expect(detailed.falsePasses.length).toBeGreaterThan(0);
    expect(detailed.falsePasses).toEqual(plain.falsePasses);
    expect(detailed.releasable).toBe(false);
    expect(detailed.disagreements[0]).toMatchObject({
      expected: "fail",
      got: "pass",
      criteria: [{ id: "explanation", feedback: "Credited." }],
    });
  });

  it("still refuses a grader that explains withholding every good answer", async () => {
    const report = await runRubricEval(async () => ({
      verdict: "fail",
      criteria: [
        { id: "explanation", level: "not_yet", decidedBy: "model", feedback: "Held back." },
      ],
    }));
    expect(report.falsePasses).toEqual([]);
    expect(report.falseFails.length).toBeGreaterThan(0);
    expect(report.goodPassRate).toBe(0);
    expect(report.releasable).toBe(false);
    expect(report.disagreements[0]).toMatchObject({ expected: "pass", got: "fail" });
  });
});
