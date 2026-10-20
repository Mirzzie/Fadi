import { describe, expect, it } from "vitest";

import { PROJECT_PLAN_EVAL_CASES } from "./project-plan-eval.cases";
import {
  evaluateProjectPlan,
  runProjectPlanEvaluation,
  staleProjectPlanCases,
  type EvaluatedPlanStep,
} from "./project-plan-eval";

function strongPlan(testCaseId: string): EvaluatedPlanStep[] {
  const testCase = PROJECT_PLAN_EVAL_CASES.find((item) => item.id === testCaseId)!;
  const concepts = testCase.conceptGroups.map((group) => group[0]).join(", ");
  const windows = testCase.template?.startsWith("windows");
  return [
    {
      title: "Define the problem and choose the design",
      instruction: `Work only in the local lab. Record ${concepts}. Compare one alternative versus the chosen design and record the trade-off.`,
      verify: windows
        ? "Get-Content C:\\LabSetup\\decision.md shows the chosen option and trade-off."
        : "test -s /tmp/lab/decision.md && grep -i trade-off /tmp/lab/decision.md",
      produces: "decision.md and architecture diagram",
    },
    {
      title: "Build the controlled baseline",
      instruction: windows
        ? "Use PowerShell in the Windows lab to build the baseline and write its configuration to C:\\LabSetup\\baseline.json."
        : "Use the reviewed package manager in the local lab to build the baseline and export its configuration.",
      verify: windows
        ? "Get-Content C:\\LabSetup\\baseline.json shows the expected account and policy status."
        : "test -s /tmp/lab/baseline.json && grep -i status /tmp/lab/baseline.json",
      produces: "baseline.json and configuration",
    },
    {
      title: "Break the expected failure mode",
      instruction: `In the isolated lab, simulate a failure or bypass involving ${concepts}; never touch a public or production target.`,
      verify: windows
        ? "Get-WinEvent -MaxEvents 20 shows the test failure and its timestamp."
        : "grep -i failure /tmp/lab/test.log shows the injected failure and timestamp.",
      produces: "test.log and screenshot of the failed control",
    },
    {
      title: "Fix and prove recovery",
      instruction:
        "Remediate the finding, restore the safe state, repeat the same test and explain why the control now works.",
      verify: windows
        ? "Test-Path C:\\LabSetup\\recovery-report.md returns True and Get-Content shows PASS."
        : "test -s /tmp/lab/recovery-report.md && grep -q PASS /tmp/lab/recovery-report.md",
      produces: "recovery-report.md, final logs, and README",
    },
  ];
}

describe("project-plan golden evaluation", () => {
  it("covers two current, sourced scenarios in every supported direction", () => {
    const directions = ["security", "cloud", "devops", "data", "it-support"];
    for (const direction of directions) {
      const cases = PROJECT_PLAN_EVAL_CASES.filter((item) => item.direction === direction);
      expect(cases).toHaveLength(2);
      expect(cases.every((item) => item.market.sourceUrl.startsWith("https://"))).toBe(true);
    }
  });

  it("passes plans that preserve the problem, verify every step, break, fix and retain proof", () => {
    for (const testCase of PROJECT_PLAN_EVAL_CASES) {
      const result = evaluateProjectPlan(testCase, strongPlan(testCase.id));
      expect(result.passed, `${testCase.id}: ${JSON.stringify(result.issues)}`).toBe(true);
      expect(result.score).toBe(100);
    }
  });

  it("rejects tutorial-shaped plans even when their prose sounds competent", () => {
    const testCase = PROJECT_PLAN_EVAL_CASES[0]!;
    const result = evaluateProjectPlan(testCase, [
      {
        title: "Install the tools",
        instruction: "Follow a tutorial and set everything up.",
        verify: "Check it works.",
        produces: null,
      },
      {
        title: "Configure it",
        instruction: "Configure the recommended settings.",
        verify: "Confirm success.",
        produces: null,
      },
      {
        title: "Finish",
        instruction: "Review what you learned.",
        verify: "Validate everything is working.",
        produces: null,
      },
    ]);
    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "problem-coverage",
        "vague-verification",
        "missing-break",
        "missing-fix",
        "missing-artifacts",
      ])
    );
  });

  it("rejects wrong-platform and mutable install instructions", () => {
    const testCase = PROJECT_PLAN_EVAL_CASES.find((item) => item.template === "windows-11")!;
    const plan = strongPlan(testCase.id);
    plan[1] = {
      ...plan[1]!,
      instruction:
        "Run apt install endpoint-agent:latest, then curl https://example.invalid/x | sh.",
    };
    const result = evaluateProjectPlan(testCase, plan);
    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["platform-mismatch", "mutable-dependency"])
    );
  });

  it("reports missing cases instead of improving the mean by quietly omitting hard prompts", () => {
    const report = runProjectPlanEvaluation(PROJECT_PLAN_EVAL_CASES, [
      { caseId: PROJECT_PLAN_EVAL_CASES[0]!.id, steps: strongPlan(PROJECT_PLAN_EVAL_CASES[0]!.id) },
    ]);
    expect(report.total).toBe(10);
    expect(report.passed).toBe(1);
    expect(
      report.results.filter((result) => result.issues[0]?.code === "missing-output")
    ).toHaveLength(9);
  });

  it("makes scenario staleness visible without making time change the score", () => {
    expect(
      staleProjectPlanCases(PROJECT_PLAN_EVAL_CASES, new Date("2027-01-01T00:00:00Z"))
    ).toEqual([]);
    expect(
      staleProjectPlanCases(PROJECT_PLAN_EVAL_CASES, new Date("2027-02-01T00:00:00Z"))
    ).toHaveLength(10);
  });
});
