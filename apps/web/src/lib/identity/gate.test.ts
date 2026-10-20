import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * THE GATE IS ONLY A GATE IF THERE IS NO PATH AROUND IT.
 *
 * Seven doors created career records; identity resolution was wired into two. Grepping
 * for the eighth and ninth found them in the interview code — after I had already
 * written "seven" in an audit. That is the whole problem in one sentence: a rule kept
 * by discipline is kept until someone adds a feature in a hurry.
 *
 * So the rule is enforced by a test rather than by a comment. It fails on a NEW caller,
 * not on the ones that already exist — the allow-list below is deliberately explicit,
 * so adding to it is a decision someone makes on purpose and can be asked about in
 * review, rather than something that happens by not noticing.
 */

/** Files permitted to write evidence rows without going through admit(). */
const ALLOWED = [
  // The gate itself.
  "src/lib/identity/admit.ts",
  // Inside a transaction with the learning commitment, resolved beforehand via
  // admitAgainst() — atomicity forces the write to use the transaction's repo.
  "src/app/dashboard/learning/actions.ts",
];

function grep(pattern: string): string[] {
  try {
    const out = execFileSync(
      "grep",
      ["-rln", "--include=*.ts", "--include=*.tsx", "-E", pattern, "src"],
      { encoding: "utf8", cwd: process.cwd() },
    );
    return out.split("\n").filter(Boolean);
  } catch {
    return []; // grep exits 1 when nothing matches
  }
}

describe("every new career record goes through the gate", () => {
  it("has no unapproved caller of the raw evidence create", () => {
    const callers = grep("createEvidenceRepository\\([^)]*\\)\\s*\\.\\s*create(Many)?\\(")
      .filter((f) => !f.endsWith(".test.ts"))
      .filter((f) => !ALLOWED.includes(f));

    // If this fails, you added a door. Route it through admitEvidence /
    // admitEvidenceBatch instead of adding yourself to ALLOWED.
    expect(callers).toEqual([]);
  });

  it("keeps the allow-list honest — every entry still exists and still writes", () => {
    // An allow-list that outlives its reason is just a hole with a comment on it.
    const writers = grep("createEvidenceRepository\\([^)]*\\)\\s*\\.\\s*create(Many)?\\(");
    for (const f of ALLOWED.filter((f) => f !== "src/lib/identity/admit.ts")) {
      expect(writers).toContain(f);
    }
  });

  it("has no unapproved caller of the raw portfolio item create", () => {
    // The portfolio's three doors (seed, sync, import) all go through
    // admitPortfolioItems; anything else is a fourth nobody audited.
    const callers = grep("\\.createItems\\(")
      .filter((f) => !f.endsWith(".test.ts"))
      .filter((f) => f !== "src/app/dashboard/portfolio/actions.ts");

    expect(callers).toEqual([]);
  });
});
