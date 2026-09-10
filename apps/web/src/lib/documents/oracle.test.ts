import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { coverageGaps, truthCheck } from "./truth-gate";

/**
 * THE INDEPENDENT ORACLE.
 *
 * 46 hand-laballed cases written by Codex against the SPEC, not against this
 * implementation — deliberately, because the person writing a checker cannot write its
 * adversarial set without producing cases their own fix passes.
 *
 * The adapter honours their rule: an empty findings list is NOT "supported" unless the
 * checker actually evaluated the applicable claim. This checker only inspects numeric
 * metrics, so a non-numeric assertion it never looked at is reported `uncertain`. The
 * resulting mismatches record a real capability gap rather than being hidden as passes.
 */
const ORACLE = join(process.cwd(), "../../docs/reviews/2026-09-10-codex-claim-oracle");
type Case = { id: string; corpus: string; generated: string; expect: string; why: string; category: string };
const RAW = JSON.parse(readFileSync(join(ORACLE, "cases.json"), "utf8"));
const CASES: Case[] = Array.isArray(RAW) ? RAW : (RAW.cases as Case[]);

/** Does this text contain anything the numeric checker is capable of judging? */
const METRIC = /(?:[$€£]\s?\d[\d,]*(?:\.\d+)?\s?[kmb]?|\b\d{1,3}\s?%|\b\d+(?:\.\d+)?x(?![a-z]))/i;

function predict(c: (typeof CASES)[number]): "supported" | "unsupported" | "uncertain" {
  const findings = truthCheck(c.generated, { corpus: c.corpus });
  if (findings.some((f) => f.severity === "block")) return "unsupported";
  // Nothing blocking. That is only "supported" if the checker actually evaluated every
  // applicable claim — otherwise it is silence, and silence is not assurance. A warn,
  // or a class of assertion this checker cannot judge, both mean "I do not know".
  if (findings.length > 0) return "uncertain";
  if (coverageGaps(c.generated).length > 0) return "uncertain";
  return METRIC.test(c.generated) ? "supported" : "uncertain";
}

describe("truth checker vs the independent oracle", () => {
  it("scores, reporting each error type separately", () => {
    const preds = CASES.map((c) => ({ id: c.id, verdict: predict(c), expect: c.expect, why: c.why, category: c.category }));
    writeFileSync(
      join(ORACLE, "predictions.json"),
      JSON.stringify(preds.map(({ id, verdict }) => ({ id, verdict })), null, 1),
    );

    // The two errors are NOT interchangeable and must never be averaged into one number.
    const falseReassurance = preds.filter((p) => p.expect === "unsupported" && p.verdict === "supported");
    const wrongRejection = preds.filter((p) => p.expect === "supported" && p.verdict === "unsupported");
    const deferred = preds.filter((p) => p.verdict === "uncertain");

    const report = [
      `cases:              ${preds.length}`,
      `exact matches:      ${preds.filter((p) => p.verdict === p.expect).length}`,
      `FALSE REASSURANCE:  ${falseReassurance.length}   (unsupported claim passed as supported)`,
      `WRONG REJECTION:    ${wrongRejection.length}   (supported claim blocked)`,
      `deferred/uncertain: ${deferred.length}`,
      "",
      "false reassurance:",
      ...falseReassurance.map((p) => `  ${p.id.padEnd(28)} ${p.why}`),
      "",
      "wrong rejection:",
      ...wrongRejection.map((p) => `  ${p.id.padEnd(28)} ${p.why}`),
    ].join("\n");
    writeFileSync(join(ORACLE, "claude-run.txt"), report);
    console.error(report);

    expect(preds).toHaveLength(46);
  });
});
