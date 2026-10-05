import { readFile } from "node:fs/promises";

import { PROJECT_PLAN_EVAL_CASES } from "./project-plan-eval.cases";
import { runProjectPlanEvaluation, staleProjectPlanCases } from "./project-plan-eval";

async function main() {
  const argument = process.argv[2];
  if (argument === "--cases") {
    process.stdout.write(`${JSON.stringify(PROJECT_PLAN_EVAL_CASES, null, 2)}\n`);
    return;
  }
  if (!argument) {
    console.error(
      "Usage: npm run eval:lab-plans -- --cases | npm run eval:lab-plans -- <generated-plans.json>"
    );
    process.exitCode = 2;
    return;
  }

  const outputs = JSON.parse(await readFile(argument, "utf8")) as Array<{
    caseId: string;
    steps: Array<{ title: string; instruction: string; verify?: string; produces?: string }>;
  }>;
  const report = runProjectPlanEvaluation(PROJECT_PLAN_EVAL_CASES, outputs);
  const stale = staleProjectPlanCases(PROJECT_PLAN_EVAL_CASES);
  process.stdout.write(
    `${JSON.stringify({ ...report, staleCases: stale.map((item) => item.id) }, null, 2)}\n`
  );
  if (report.passed !== report.total || stale.length > 0) process.exitCode = 1;
}

void main();
