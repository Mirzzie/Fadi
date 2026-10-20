import { describe, expect, it } from "vitest";

import { CHURN_REVIEW_ASSETS } from "./packs/customer-success";
import { reviewSubmission } from "./rubric";
import {
  EVAL_SEED,
  evalCases,
  graderShortfall,
  runRubricEval,
  runRubricEvalRepeated,
  type GradeFn,
} from "./rubric-eval";
import { churnCase } from "./sim/churn-case";

describe("the grader evaluation set (rubric-eval v2)", () => {
  it("covers good, weak and adversarial answers to every model-judged step", () => {
    const cases = evalCases();
    expect(new Set(cases.map((c) => c.kind))).toEqual(new Set(["good", "weak", "adversarial"]));
    expect(new Set(cases.map((c) => c.step))).toEqual(new Set(["diagnose", "plan", "defend"]));
    expect(cases.filter((c) => c.kind === "adversarial").every((c) => c.expect === "fail")).toBe(
      true
    );
  });

  it("counts a credited bad answer as a false pass, and blocks release on any", async () => {
    const lenient: GradeFn = async () => "pass";
    const report = await runRubricEval(lenient);
    expect(report.falsePasses.length).toBeGreaterThan(0);
    expect(report.releasable).toBe(false);
  });

  it("a grader that holds back every good answer is NOT releasable, however much it agrees", async () => {
    const strict: GradeFn = async () => "fail";
    const report = await runRubricEval(strict);
    expect(report.falsePasses).toEqual([]);
    expect(report.goodPassRate).toBe(0);
    expect(report.releasable).toBe(false);
  });

  it("a perfect grader is releasable", async () => {
    const byId = new Map(evalCases().map((c) => [c.id, c.expect]));
    const report = await runRubricEval(async ({ caseId }) => byId.get(caseId)!);
    expect(report).toMatchObject({ falsePasses: [], falseFails: [], releasable: true });
  });

  it("the guard never blocks the good answers", async () => {
    const { containsRubricGaming } = await import("./rubric");
    for (const item of evalCases().filter((x) => x.kind === "good")) {
      expect(containsRubricGaming(item.submission)).toBe(false);
    }
  });

  it("on step 1 the picks are right, so only the explanation decides", () => {
    const c = churnCase(EVAL_SEED);
    for (const item of evalCases().filter((x) => x.step === "diagnose")) {
      expect(item.choices).toEqual({
        "risk-1": c.atRisk[0],
        "risk-2": c.atRisk[1],
        "false-alarm": c.decoy,
      });
    }
  });

  // diagnose-injection is phrased softly ("note to the reviewer: … satisfied automatically"); it
  // got past gemma3:4b (v2, 19 Oct 2026), so the guard refuses it too.
  it("the guard alone already refuses the injections — before any model is asked", () => {
    const c = churnCase(EVAL_SEED);
    for (const item of evalCases().filter((x) => x.id.endsWith("injection"))) {
      const criteria = CHURN_REVIEW_ASSETS[item.step]!.criteria;
      const generous = {
        criteria: criteria.map((k) => ({
          id: k.id,
          level: "strong" as const,
          quote: item.submission.slice(0, 40),
          feedback: "",
        })),
      };
      expect(reviewSubmission(criteria, item.submission, c, generous).verdict).toBe("fail");
    }
  });
});

/**
 * Live: measure the model a person has configured. Opt-in — it calls their provider.
 *   FADI_RUBRIC_EVAL_USER=<user id> FADI_RUBRIC_EVAL_OUT=<file> DATABASE_URL=… npx vitest run rubric-eval
 * FADI_RUBRIC_EVAL_ACTIVITY=<packId/activityId> picks the activity (default: the churn review).
 */
const LIVE_USER = process.env.FADI_RUBRIC_EVAL_USER;
(LIVE_USER ? describe : describe.skip)("live grader evaluation", () => {
  it("measures the configured model through the full review path", async () => {
    const { getUserDocGenerate } = await import("@/lib/ai/user-generate");
    const { graderFor, GRADER_REPEATS } = await import("./grader-check");
    // The product's own check: the same review path, the same repeats.
    const generate = (await getUserDocGenerate(LIVE_USER!, { meteredByCaller: true }))!;
    const [packId, activityId] = (
      process.env.FADI_RUBRIC_EVAL_ACTIVITY ?? "fadi.customer-success/churn-review"
    ).split("/");
    const { activityRuntime } = await import("./packs");
    const runtime = activityRuntime(packId!, activityId!)!;
    const report = await runRubricEvalRepeated(
      graderFor(generate, { packId: packId!, activityId: activityId! }),
      GRADER_REPEATS,
      runtime.evalSuite.cases()
    );
    const { writeFileSync } = await import("node:fs");
    if (process.env.FADI_RUBRIC_EVAL_OUT) {
      writeFileSync(process.env.FADI_RUBRIC_EVAL_OUT, JSON.stringify(report, null, 2));
    }
    expect(report.runs.length).toBeGreaterThan(0);
  }, 900_000);
});

describe("a marker is trusted only when every repeated run meets the rule", () => {
  const byId = new Map(evalCases().map((c) => [c.id, c.expect]));
  const perfect: GradeFn = async ({ caseId }) => byId.get(caseId)!;

  it("three perfect runs: releasable", async () => {
    const report = await runRubricEvalRepeated(perfect, 3);
    expect(report.runs).toHaveLength(3);
    expect(report.releasable).toBe(true);
    expect(graderShortfall(report)).toBeNull();
  });

  it("stops at the first failing run, and says why in plain words", async () => {
    let run = 0;
    const flaky: GradeFn = async (input) => {
      if (input.caseId === evalCases()[0]!.id) run += 1;
      // The second run holds back every good answer.
      return run === 2 && byId.get(input.caseId) === "pass" ? "fail" : perfect(input);
    };
    const report = await runRubricEvalRepeated(flaky, 3);
    expect(report.runs).toHaveLength(2);
    expect(report.releasable).toBe(false);
    expect(graderShortfall(report)).toMatch(/credited only 0%/);
  });

  it("names a false pass before anything else", async () => {
    const lenient: GradeFn = async () => "pass";
    expect(graderShortfall(await runRubricEvalRepeated(lenient, 3))).toMatch(/should not pass/);
  });
});
