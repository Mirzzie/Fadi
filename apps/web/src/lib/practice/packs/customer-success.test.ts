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

describe("the decisions are picked, and checked exactly (Codex P1, 19 Oct 2026)", () => {
  const c = churnCase("seed-a");
  const criteria = CHURN_REVIEW_ASSETS.diagnose!.criteria;
  const fields = CHURN_REVIEW_ASSETS.diagnose!.choices!(c);
  const review = (choices: Record<string, string>, text = "My analysis of the accounts.") =>
    reviewSubmission(criteria as never, { text, choices }, c, { criteria: [] }).results;
  const level = (results: ReturnType<typeof review>, id: string) =>
    results.find((r) => r.id === id)?.level;

  it("offers this case's own accounts, and 'none' for the false alarm", () => {
    const names = c.accounts.map((a) => a.name);
    expect(fields.map((f) => f.id)).toEqual(["risk-1", "risk-2", "false-alarm"]);
    expect(fields[0]!.options).toEqual(names);
    expect(fields[2]!.options).toEqual([...names, "None of them"]);
  });

  it("credits picking both real risks — either order — and the real false alarm", () => {
    const results = review({
      "risk-1": c.atRisk[1],
      "risk-2": c.atRisk[0],
      "false-alarm": c.decoy,
    });
    expect(level(results, "names-risks")).toBe("meets");
    expect(level(results, "spots-decoy")).toBe("meets");
  });

  it("isn't fooled by the right words in the writing: the picks decide", () => {
    const wrong = c.accounts.find((a) => !c.atRisk.includes(a.name) && a.name !== c.decoy)!;
    const results = review(
      { "risk-1": wrong.name, "risk-2": c.atRisk[0], "false-alarm": "None of them" },
      `${c.atRisk[0]} and ${c.atRisk[1]} are at risk. ${c.decoy}'s drop is seasonal.`
    );
    expect(level(results, "names-risks")).toBe("not_yet");
    expect(level(results, "spots-decoy")).toBe("not_yet");
  });

  it("says when the false alarm picked is another account, without naming the right one", () => {
    const results = review({
      "risk-1": c.atRisk[0],
      "risk-2": c.atRisk[1],
      "false-alarm": c.atRisk[0],
    });
    const feedback = results.find((r) => r.id === "spots-decoy")!.feedback;
    expect(feedback).toMatch(/isn't the false alarm/);
    expect(feedback).not.toContain(c.decoy);
  });

  it("fails picks copied from someone else's case", () => {
    const other = churnCase("someone-else");
    const overlap = other.atRisk.filter((n) => c.atRisk.includes(n)).length;
    const results = review({ "risk-1": other.atRisk[0], "risk-2": other.atRisk[1] });
    if (overlap < 2) expect(level(results, "names-risks")).toBe("not_yet");
  });

  it("leaves the explanation to the rubric review", () => {
    expect(criteria.find((k) => k.id === "explains")?.kind).toBe("quality");
  });
});

describe("the hint ladder", () => {
  const c = churnCase("seed-a");
  it("has three hints per step, none naming an account or giving the answer", () => {
    for (const step of CUSTOMER_SUCCESS_PACK.activities[0]!.steps) {
      const hints = CHURN_REVIEW_ASSETS[step.id]!.hints;
      expect(hints).toHaveLength(3);
      for (const hint of hints) {
        for (const account of c.accounts) expect(hint).not.toContain(account.name.split(" ")[0]);
      }
    }
  });
});

describe("backing each at-risk account with its own figures — checked exactly (19 Oct 2026)", () => {
  const c = churnCase("seed-a");
  const evidence = CHURN_REVIEW_ASSETS.diagnose!.criteria.find((x) => x.id === "evidence")!;
  const check = (text: string) =>
    evidence.kind === "fact"
      ? evidence.check({ text, choices: { "risk-1": c.atRisk[0], "risk-2": c.atRisk[1] } }, c)
      : { met: false, seen: "" };
  const row = (name: string) => c.accounts.find((a) => a.name === name)!;
  const describe = (name: string) => {
    const a = row(name);
    const change = Math.round(((a.activeNow - a.active90) / a.active90) * 100);
    return `${name}: weekly users ${change}% over 90 days, renewal in ${a.renewalDays} days, $${a.arrK}k ARR.`;
  };

  it("credits an answer that cites two of each account's figures, wherever they are named first", () => {
    const text = `${c.atRisk[0]} and ${c.atRisk[1]} are at risk. ${describe(c.atRisk[0])} ${describe(c.atRisk[1])}`;
    expect(check(text).met).toBe(true);
  });

  it("doesn't credit names without figures", () => {
    expect(
      check(`${c.atRisk[0]} and ${c.atRisk[1]} are at risk because things look bad.`).met
    ).toBe(false);
  });

  it("never names an account the person didn't pick (it would give the answer away)", () => {
    const wrong = c.accounts.find((a) => !c.atRisk.includes(a.name) && a.name !== c.decoy)!;
    const missed = c.atRisk[1];
    const result =
      evidence.kind === "fact"
        ? evidence.check(
            { text: "They look bad.", choices: { "risk-1": c.atRisk[0], "risk-2": wrong.name } },
            c
          )
        : { met: true, seen: "" };
    expect(result.met).toBe(false);
    expect(result.seen).not.toContain(missed);
  });

  it("doesn't credit figures from someone else's case", () => {
    const other = churnCase("someone-else");
    const borrowed = other.accounts.find(
      (a) => !c.accounts.some((b) => b.renewalDays === a.renewalDays || b.arrK === a.arrK)
    )!;
    const text = `${c.atRisk[0]}: renewal in ${borrowed.renewalDays} days, $${borrowed.arrK}k ARR. ${describe(c.atRisk[1])}`;
    expect(check(text).met).toBe(false);
  });
});
