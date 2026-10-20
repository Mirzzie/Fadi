import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { coverageGaps, hasCheckableMetric, truthCheck, type TruthFinding } from "./truth-gate";

/**
 * THE INDEPENDENT ORACLE — 46 cases written by Codex against the spec, not against this
 * implementation.
 *
 * The first version of this file asserted only `expect(preds).toHaveLength(46)`. Codex's
 * verdict was exact: returning "supported" for every case would have passed. That is the
 * third test I have written in this codebase that could not fail — after the hardcoded
 * copy scanner and the first canonical-invariant suite — so the mutation check at the
 * bottom is not decoration. A guard that has never been seen to fail is an assumption.
 *
 * The counts below are a BASELINE, not a target. Deferral is tracked explicitly because
 * "I cannot judge this" resolves every harm counter while helping nobody: solving one
 * error by deferring everything must fail this test, not pass it.
 */
const ORACLE = join(process.cwd(), "../../docs/reviews/2026-09-10-codex-claim-oracle");
type Case = { id: string; corpus: string; generated: string; expect: string; why: string; category: string };
const RAW = JSON.parse(readFileSync(join(ORACLE, "cases.json"), "utf8"));
const CASES: Case[] = Array.isArray(RAW) ? RAW : (RAW.cases as Case[]);

type Verdict = "supported" | "unsupported" | "uncertain";

/**
 * Production checker → oracle label.
 *
 * Uses the PRODUCTION metric parser (`hasCheckableMetric`). The previous adapter carried
 * its own percentage regex, so coverage was decided by a second parser that could drift
 * from the one being measured — Codex flagged it, and it would have quietly turned an
 * adapter change into an apparent checker improvement.
 */
function predict(c: Case): { verdict: Verdict; findings: TruthFinding[]; gaps: number } {
  const findings = truthCheck(c.generated, { corpus: c.corpus });
  const gaps = coverageGaps(c.generated).length;
  if (findings.some((f) => f.severity === "block")) return { verdict: "unsupported", findings, gaps };
  // Silence is assurance only when everything applicable was actually examined.
  if (findings.length > 0 || gaps > 0) return { verdict: "uncertain", findings, gaps };
  return { verdict: hasCheckableMetric(c.generated) ? "supported" : "uncertain", findings, gaps };
}

function score(verdictFor: (c: Case) => Verdict) {
  const rows = CASES.map((c) => ({ c, got: verdictFor(c) }));
  return {
    rows,
    exact: rows.filter((r) => r.got === r.c.expect).length,
    falseReassurance: rows.filter((r) => r.c.expect === "unsupported" && r.got === "supported"),
    wrongRejection: rows.filter((r) => r.c.expect === "supported" && r.got === "unsupported"),
    overconfident: rows.filter((r) => r.c.expect === "uncertain" && r.got !== "uncertain"),
    deferred: rows.filter((r) => r.got === "uncertain"),
  };
}

/** Committed capabilities. Each is a defect the oracle caught and this checker now handles. */
const COMMITTED: Array<[string, Verdict, string]> = [
  ["substring-year", "unsupported", "a year must not corroborate a percentage"],
  ["substring-integer", "unsupported", "digits inside another number are not evidence"],
  ["round-qualified", "supported", "19.8% supports 'approximately 20%'"],
  ["currency-format", "supported", "USD 5000 is the same amount as $5,000 USD"],
  ["prompt-injection", "unsupported", "imported instruction text cannot corroborate"],
  ["attestation", "unsupported", "a self-attested record cannot establish 'independently verified'"],
  ["mixed-claims", "uncertain", "an unexamined clause must not pass in silence"],
  ["role-transfer", "uncertain", "attribution is not checked, so it must not be affirmed"],
];

describe("truth checker vs the independent oracle", () => {
  const result = score((c) => predict(c).verdict);

  it("records the run with raw findings, so an adapter change cannot look like a fix", () => {
    const detail = CASES.map((c) => {
      const p = predict(c);
      return { id: c.id, verdict: p.verdict, expected: c.expect, findings: p.findings, coverageGaps: p.gaps };
    });
    writeFileSync(
      join(ORACLE, "predictions.json"),
      JSON.stringify(detail.map(({ id, verdict }) => ({ id, verdict })), null, 1),
    );
    writeFileSync(
      join(ORACLE, "claude-run.json"),
      JSON.stringify(
        {
          checkerSha256: createHash("sha256")
            .update(readFileSync(join(process.cwd(), "src/lib/documents/truth-gate.ts")))
            .digest("hex"),
          exact: result.exact,
          falseReassurance: result.falseReassurance.length,
          wrongRejection: result.wrongRejection.length,
          overconfidentOnUncertain: result.overconfident.length,
          deferred: result.deferred.length,
          cases: detail,
        },
        null,
        1,
      ),
    );
    expect(detail).toHaveLength(46);
  });

  it("never passes an unsupported claim as supported", () => {
    expect(result.falseReassurance.map((r) => r.c.id)).toEqual([]);
  });

  it("never blocks a supported claim", () => {
    expect(result.wrongRejection.map((r) => r.c.id)).toEqual([]);
  });

  it("does not exceed the known overconfidence on deliberately-uncertain cases", () => {
    // Codex's qualification: "both harms at zero" covers two counters, not every harmful
    // decision. These two are a POLICY disagreement pending a versioned two-axis
    // contract, kept visible rather than asserted away.
    expect(result.overconfident.map((r) => r.c.id).sort()).toEqual(["attestation-bare", "round-bare"]);
  });

  it("does not solve errors by deferring more", () => {
    // The baseline. Deferral costs the user review work, so an increase is a regression
    // even though it lowers every harm counter.
    expect(result.deferred.length).toBeLessThanOrEqual(31);
    expect(result.exact).toBeGreaterThanOrEqual(15);
  });

  it.each(COMMITTED)("case %s stays %s — %s", (id, expected) => {
    const c = CASES.find((x) => x.id === id);
    expect(c, `oracle case ${id} is missing`).toBeDefined();
    expect(predict(c!).verdict).toBe(expected);
  });

  it("MUTATION CHECK: an adapter that approves everything must fail this suite", () => {
    // Proof the guards above can fail. Without this the whole file is an assumption.
    const approveAll = score(() => "supported");
    expect(approveAll.falseReassurance.length).toBeGreaterThan(0);
    expect(approveAll.overconfident.length).toBeGreaterThan(0);

    // And the mirror: deferring everything zeroes both harm counters, which is exactly
    // why deferral is asserted separately above.
    const deferAll = score(() => "uncertain");
    expect(deferAll.falseReassurance.length).toBe(0);
    expect(deferAll.wrongRejection.length).toBe(0);
    expect(deferAll.deferred.length).toBeGreaterThan(31);
  });
});
