import { labOsOf, osViolations, toolchainViolations } from "./host-and-lab";
import type { TemplateKey } from "./templates";

export type EvaluatedPlanStep = {
  title: string;
  instruction: string;
  verify?: string | null;
  produces?: string | null;
};

export type ProjectPlanEvalCase = {
  id: string;
  direction: "security" | "cloud" | "devops" | "data" | "it-support";
  title: string;
  detail: string;
  template: TemplateKey | null;
  /** Each group is a concept; one synonym from every group must survive into the plan. */
  conceptGroups: string[][];
  market: { signal: string; sourceUrl: string; reviewBy: string };
};

export type PlanQualityIssue = {
  code:
    | "step-count"
    | "problem-coverage"
    | "vague-verification"
    | "missing-artifacts"
    | "missing-break"
    | "missing-fix"
    | "missing-decision"
    | "platform-mismatch"
    | "unsafe-scope"
    | "mutable-dependency"
    | "missing-output";
  severity: "critical" | "warning";
  message: string;
};

export type PlanQualityScore = {
  score: number;
  passed: boolean;
  issues: PlanQualityIssue[];
  dimensions: {
    bounded: number;
    relevance: number;
    verification: number;
    buildBreakFix: number;
    evidence: number;
    platform: number;
    decision: number;
    safety: number;
  };
};

const BREAK_RE =
  /\b(?:attack|attempt|break|bypass|corrupt|delete|deny|disconnect|drift|expire|fail(?:ure)?|inject|invalid|kill|leak|load test|misconfigur|outage|replay|restore test|rotate|simulate|tamper|throttle|unplug)\b/i;
const FIX_RE =
  /\b(?:correct|fix|harden|mitigat|patch|recover|remediat|repair|restore|rollback|rotate|tune|update the control)\b/i;
const DECISION_RE =
  /\b(?:alternative|compared with|instead of|option|trade-?off|versus|vs\.?|why (?:this|choose|chosen))\b/i;
const CONCRETE_VERIFY_RE =
  /(?:\$|>|\b(?:curl|dig|docker|event viewer|get-|grep|Invoke-|journalctl|kubectl|log|metric|nmap|nslookup|ping|psql|screenshot|select\b|status|test-|trace|winget)\b|\b(?:exit code|http\s+\d{3}|returns?\s+\d|shows?\s+|contains?\s+|equals?\s+|fails?\s+with|succeeds?\s+with)\b)/i;
const VAGUE_VERIFY_RE =
  /^(?:check|confirm|ensure|make sure|test|validate|verify)(?: (?:it|this|that|everything))? (?:works|is working|succeeded|successfully)?[.!]?$/i;
const ARTIFACT_RE =
  /\b(?:artifact|case study|config|csv|dashboard|diagram|evidence|export|finding|json|log|metric|policy|readme|report|repo|repository|runbook|screenshot|script|trace|video|walkthrough|ya?ml)\b/i;
const PUBLIC_TARGET_RE =
  /\b(?:public internet|production|real customer|third[- ]party|random (?:host|ip)|scan the internet|external target)\b/i;
const EXPLICIT_LAB_SCOPE_RE =
  /\b(?:lab|local|localhost|loopback|sandbox|test environment|test tenant)\b/i;
const MUTABLE_RE = /(?:\b(?:latest|edge|nightly)\b|curl\s+[^\n|]+\|\s*(?:ba)?sh)/i;

function textOf(steps: EvaluatedPlanStep[]) {
  return steps
    .map((step) =>
      [step.title, step.instruction, step.verify ?? "", step.produces ?? ""].join("\n")
    )
    .join("\n");
}

function add(
  issues: PlanQualityIssue[],
  code: PlanQualityIssue["code"],
  severity: PlanQualityIssue["severity"],
  message: string
) {
  issues.push({ code, severity, message });
}

/**
 * Score a generated plan without another model call. The gate is intentionally structural:
 * it measures the properties Fadi promises and leaves prose taste to human review.
 */
export function evaluateProjectPlan(
  testCase: ProjectPlanEvalCase,
  steps: EvaluatedPlanStep[]
): PlanQualityScore {
  const issues: PlanQualityIssue[] = [];
  const all = textOf(steps);

  const bounded = steps.length >= 3 && steps.length <= 8 ? 5 : 0;
  if (!bounded) add(issues, "step-count", "critical", "A new project needs 3–8 executable steps.");

  const covered = testCase.conceptGroups.filter((group) =>
    group.some((term) => all.toLowerCase().includes(term.toLowerCase()))
  ).length;
  const relevance = Math.round((covered / Math.max(testCase.conceptGroups.length, 1)) * 15);
  if (covered < testCase.conceptGroups.length) {
    const missing = testCase.conceptGroups
      .filter((group) => !group.some((term) => all.toLowerCase().includes(term.toLowerCase())))
      .map((group) => group.join("/"));
    add(
      issues,
      "problem-coverage",
      "critical",
      `The plan lost required problem concepts: ${missing.join(", ")}.`
    );
  }

  const vagueSteps = steps.filter((step) => {
    const verify = step.verify?.trim() ?? "";
    return !verify || VAGUE_VERIFY_RE.test(verify) || !CONCRETE_VERIFY_RE.test(verify);
  });
  const verification = Math.round(
    ((steps.length - vagueSteps.length) / Math.max(steps.length, 1)) * 20
  );
  if (vagueSteps.length > 0) {
    add(
      issues,
      "vague-verification",
      "critical",
      `Concrete verification is missing from: ${vagueSteps.map((step) => step.title).join(", ")}.`
    );
  }

  const hasBreak = BREAK_RE.test(all);
  const hasFix = FIX_RE.test(all);
  const buildBreakFix = (hasBreak ? 10 : 0) + (hasFix ? 10 : 0);
  if (!hasBreak)
    add(issues, "missing-break", "critical", "Nothing deliberately tests a failure or bypass.");
  if (!hasFix)
    add(issues, "missing-fix", "critical", "The plan never repairs what the test finds.");

  const artifactSteps = steps.filter((step) => ARTIFACT_RE.test(step.produces?.trim() ?? ""));
  const requiredArtifacts = Math.min(3, Math.max(2, Math.ceil(steps.length / 3)));
  const evidence = Math.min(15, Math.round((artifactSteps.length / requiredArtifacts) * 15));
  if (artifactSteps.length < requiredArtifacts) {
    add(
      issues,
      "missing-artifacts",
      "critical",
      `Only ${artifactSteps.length} steps produce durable proof; this plan needs at least ${requiredArtifacts}.`
    );
  }

  const mismatch = testCase.template
    ? [
        ...osViolations(all, labOsOf(testCase.template)!),
        ...toolchainViolations(all, testCase.template),
      ]
    : [];
  const platform = mismatch.length === 0 ? 15 : 0;
  if (mismatch.length > 0) {
    add(
      issues,
      "platform-mismatch",
      "critical",
      `The plan contradicts its lab: ${[...new Set(mismatch)].join(", ")}.`
    );
  }

  const decision = DECISION_RE.test(all) ? 5 : 0;
  if (!decision) {
    add(
      issues,
      "missing-decision",
      "warning",
      "No design choice records an alternative or trade-off."
    );
  }

  let safety = 5;
  if (PUBLIC_TARGET_RE.test(all) && !EXPLICIT_LAB_SCOPE_RE.test(all)) {
    safety = 0;
    add(
      issues,
      "unsafe-scope",
      "critical",
      "Failure testing is not explicitly confined to owned lab targets."
    );
  }
  if (MUTABLE_RE.test(all)) {
    safety = 0;
    add(
      issues,
      "mutable-dependency",
      "critical",
      "The plan installs mutable or unreviewed code (`latest`, `edge`, or curl-to-shell)."
    );
  }

  const dimensions = {
    bounded,
    relevance,
    verification,
    buildBreakFix,
    evidence,
    platform,
    decision,
    safety,
  };
  const score = Object.values(dimensions).reduce((sum, value) => sum + value, 0);
  return {
    score,
    passed: score >= 80 && !issues.some((issue) => issue.severity === "critical"),
    issues,
    dimensions,
  };
}

export function runProjectPlanEvaluation(
  cases: ProjectPlanEvalCase[],
  outputs: Array<{ caseId: string; steps: EvaluatedPlanStep[] }>
) {
  const byCase = new Map(outputs.map((output) => [output.caseId, output.steps]));
  const results = cases.map((testCase) => {
    const steps = byCase.get(testCase.id);
    if (!steps) {
      return {
        caseId: testCase.id,
        direction: testCase.direction,
        score: 0,
        passed: false,
        issues: [
          {
            code: "missing-output" as const,
            severity: "critical" as const,
            message: "No generated plan was supplied for this case.",
          },
        ],
      };
    }
    const result = evaluateProjectPlan(testCase, steps);
    return {
      caseId: testCase.id,
      direction: testCase.direction,
      score: result.score,
      passed: result.passed,
      issues: result.issues,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    meanScore: Math.round(results.reduce((sum, result) => sum + result.score, 0) / results.length),
    passed: results.filter((result) => result.passed).length,
    total: results.length,
    results,
  };
}

export function staleProjectPlanCases(cases: ProjectPlanEvalCase[], now = new Date()) {
  return cases.filter((testCase) => new Date(`${testCase.market.reviewBy}T23:59:59Z`) < now);
}
