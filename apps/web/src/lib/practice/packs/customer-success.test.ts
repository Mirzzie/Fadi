import { describe, expect, it } from "vitest";

import { evaluatePracticePack, practicePackSchema } from "../pack";
import { reviewSubmission } from "../rubric";
import { churnCase, riskScore } from "../sim/churn-case";
import { CHURN_REVIEW_ASSETS, CUSTOMER_SUCCESS_PACK, churnBrief } from "./customer-success";
import { activityRuntime } from "./index";

describe("the customer-success pack", () => {
  it("is a valid, honestly experimental Practice pack", () => {
    expect(() => practicePackSchema.parse(CUSTOMER_SUCCESS_PACK)).not.toThrow();
    expect(CUSTOMER_SUCCESS_PACK.trust).toBe("experimental");
    const steps = CUSTOMER_SUCCESS_PACK.activities[0]!.steps;
    expect(
      steps.every((s) => s.environment.kind === "document" && s.assessment.kind === "rubric")
    ).toBe(true);
    // Every step has rubric assets, and none of them is visible in the step itself.
    for (const step of steps) {
      expect(CHURN_REVIEW_ASSETS[step.id]).toBeDefined();
      expect(step.instruction).not.toMatch(/example answer/i);
    }
    // Valid, but not recommendable: experimental, and no release rehearsal yet (Codex V4 gate).
    const evaluation = evaluatePracticePack(CUSTOMER_SUCCESS_PACK);
    expect(evaluation.valid).toBe(true);
    expect(evaluation.recommendable).toBe(false);
  });

  it("resolves through the registry, by exact version", () => {
    expect(activityRuntime("fadi.customer-success", "churn-review")).not.toBeNull();
    expect(activityRuntime("fadi.customer-success", "churn-review", "9.9.9")).toBeNull();
  });
});

describe("a case per run (per-learner values)", () => {
  it("is the same for the same seed, different for another", () => {
    expect(churnCase("seed-a")).toEqual(churnCase("seed-a"));
    const a = churnCase("seed-a");
    const b = churnCase("seed-b");
    expect(JSON.stringify(a.accounts)).not.toBe(JSON.stringify(b.accounts));
  });

  it("computes the facts from the figures: two real risks, and a seasonal decoy that isn't one", () => {
    for (const seed of ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"]) {
      const c = churnCase(seed);
      expect(new Set(c.atRisk).size).toBe(2);
      expect(c.atRisk).not.toContain(c.decoy);
      const scores = c.accounts.map(riskScore).sort((x, y) => y - x);
      expect(scores[1]! - scores[2]!).toBeGreaterThan(10); // the top two stand clearly apart
    }
  });

  it("shows the person the table and the CRM note, never the conclusions", () => {
    const c = churnCase("seed-a");
    const brief = churnBrief(c);
    expect(brief).toContain(c.accounts[0]!.name);
    expect(brief).toContain("busy season");
    expect(brief).not.toMatch(/at risk|decoy/i);
  });
});

describe("fact criteria are decided in code from the person's own case", () => {
  const c = churnCase("seed-a");
  const criteria = CHURN_REVIEW_ASSETS.diagnose!.criteria;
  const review = (text: string) =>
    reviewSubmission(criteria as never, text, c, { criteria: [] }).results;

  it("credits naming both real risks and seeing the decoy is seasonal", () => {
    const text = `${c.atRisk[0]} and ${c.atRisk[1]} are at risk. ${c.decoy}'s drop is seasonal — their busy season is later.`;
    const results = review(text);
    expect(results.find((r) => r.id === "names-risks")?.level).toBe("meets");
    expect(results.find((r) => r.id === "spots-decoy")?.level).toBe("meets");
  });

  it("fails a copied answer from someone else's case", () => {
    const other = churnCase("someone-else");
    const copied = `${other.atRisk[0]} and ${other.atRisk[1]} are at risk; ${other.decoy} is seasonal.`;
    const overlap = other.atRisk.filter((n) => c.atRisk.includes(n)).length;
    const results = review(copied);
    if (overlap < 2) expect(results.find((r) => r.id === "names-risks")?.level).toBe("not_yet");
  });

  it("calls out treating the seasonal account as churn", () => {
    const results = review(`${c.decoy} is the biggest risk: usage collapsed.`);
    expect(results.find((r) => r.id === "spots-decoy")?.feedback).toMatch(/CRM notes/);
  });
});
