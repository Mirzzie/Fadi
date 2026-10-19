import { describe, expect, it } from "vitest";

import { churnBrief, CHURN_REVIEW_ASSETS } from "./packs/customer-success";
import {
  reviewSubmission,
  rubricPrompt,
  rubricScoresSchema,
  type QualityCriterion,
} from "./rubric";
import { EVAL_SEED, evalCases, runRubricEval, type GradeFn } from "./rubric-eval";
import { churnCase } from "./sim/churn-case";

describe("the grader evaluation set (rubric-eval v1)", () => {
  it("covers good, weak and adversarial answers to both model-judged steps", () => {
    const cases = evalCases();
    expect(new Set(cases.map((c) => c.kind))).toEqual(new Set(["good", "weak", "adversarial"]));
    expect(new Set(cases.map((c) => c.step))).toEqual(new Set(["plan", "defend"]));
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

  it("the guard alone already refuses the direct injections — before any model is asked", () => {
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
 */
const LIVE_USER = process.env.FADI_RUBRIC_EVAL_USER;
(LIVE_USER ? describe : describe.skip)("live grader evaluation", () => {
  it("measures the configured model through the full review path", async () => {
    const { getUserDocGenerate } = await import("@/lib/ai/user-generate");
    const generate = (await getUserDocGenerate(LIVE_USER!))!;
    const c = churnCase(EVAL_SEED);
    const brief = churnBrief(c);
    const grade: GradeFn = async ({ step, submission }) => {
      const criteria = CHURN_REVIEW_ASSETS[step]!.criteria;
      const quality = criteria.filter((k): k is QualityCriterion => k.kind === "quality");
      try {
        const prompt = rubricPrompt({ brief, task: step, criteria: quality, submission });
        const scores = await generate.structured(
          prompt.system,
          prompt.user,
          rubricScoresSchema,
          "rubric_review",
          {
            maxTokens: 1500,
          }
        );
        return reviewSubmission(criteria, submission, c, scores).verdict;
      } catch {
        return "error";
      }
    };
    const report = await runRubricEval(grade);
    const { writeFileSync } = await import("node:fs");
    if (process.env.FADI_RUBRIC_EVAL_OUT) {
      writeFileSync(process.env.FADI_RUBRIC_EVAL_OUT, JSON.stringify(report, null, 2));
    }
    expect(report.cases).toBe(evalCases().length);
  }, 900_000);
});
