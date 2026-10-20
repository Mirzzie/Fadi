import { describe, expect, it } from "vitest";

import { evaluatePracticePack, practicePackSchema } from "../pack";
import { reviewSubmission } from "../rubric";
import { clock, signinCase, signinIps } from "../sim/signin-case";
import { activityRuntime } from "./index";
import {
  SECURITY_OPERATIONS_PACK,
  SUSPICIOUS_SIGNINS_ASSETS,
  signinBrief,
} from "./security-operations";

const SEEDS = Array.from({ length: 40 }, (_, i) => `seed-${i}`);
const DOC_RANGES = /^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d{1,3}$/;

describe("the security-operations pack", () => {
  it("is a valid, honestly experimental Practice pack, installed by exact version", () => {
    expect(() => practicePackSchema.parse(SECURITY_OPERATIONS_PACK)).not.toThrow();
    expect(SECURITY_OPERATIONS_PACK.trust).toBe("experimental");
    const evaluation = evaluatePracticePack(SECURITY_OPERATIONS_PACK);
    expect(evaluation.valid).toBe(true);
    expect(evaluation.recommendable).toBe(false);
    expect(activityRuntime("fadi.security-operations", "suspicious-sign-ins")).not.toBeNull();
    for (const step of SECURITY_OPERATIONS_PACK.activities[0]!.steps) {
      expect(SUSPICIOUS_SIGNINS_ASSETS[step.id]).toBeDefined();
    }
  });
});

describe("a sign-in log per run", () => {
  it("is the same for the same seed and different for another", () => {
    expect(signinCase("a")).toEqual(signinCase("a"));
    expect(JSON.stringify(signinCase("a").log)).not.toBe(JSON.stringify(signinCase("b").log));
  });

  it("is internally true to its answers, for every seed", () => {
    for (const seed of SEEDS) {
      const c = signinCase(seed);
      const fromAttacker = c.log.filter((e) => e.ip === c.attackerIp);
      // Every address is from the documentation ranges: nothing points at a real host.
      for (const e of c.log) expect(e.ip).toMatch(DOC_RANGES);
      // The account fell from the attacking address, at the time recorded.
      const fell = fromAttacker.filter((e) => e.result === "Success");
      expect(fell).toEqual([
        expect.objectContaining({ user: c.compromised, minute: c.compromisedAt }),
      ]);
      // The shape matches the kind.
      const targeted = new Set(fromAttacker.map((e) => e.user));
      if (c.attack === "password-spray") expect(targeted.size).toBeGreaterThanOrEqual(5);
      else expect(targeted).toEqual(new Set([c.compromised]));
      // The innocent activity never comes from the attacker, and isn't the account that fell.
      expect(c.decoy).not.toBe(c.compromised);
      expect(
        c.log.filter((e) => e.user === c.decoy && e.ip === c.attackerIp && e.result === "Success")
      ).toEqual([]);
      expect(c.firstAttempt).toBeLessThan(c.compromisedAt);
      // The decoy's activity is self-consistent: nothing from home or the office in Ireland
      // while they're locked out or abroad.
      // (The attacker may have tried their account too; that's the attack, not their story.)
      const own = c.log.filter((e) => e.user === c.decoy && e.ip !== c.attackerIp);
      if (c.decoyKind === "traveller") {
        expect(new Set(own.map((e) => e.network))).toEqual(new Set(["Hotel Wi-Fi"]));
      } else {
        const locked = own.find((e) => e.detail === "Account locked")!;
        expect(own.filter((e) => e.minute > locked.minute)).toEqual([
          expect.objectContaining({ detail: expect.stringMatching(/reset by helpdesk/) }),
        ]);
      }
    }
  });

  it("covers both kinds of attack, both ways past MFA and both false alarms", () => {
    const cases = SEEDS.map(signinCase);
    expect(new Set(cases.map((c) => c.attack))).toEqual(new Set(["password-spray", "brute-force"]));
    expect(new Set(cases.map((c) => c.bypass))).toEqual(
      new Set(["legacy-protocol", "mfa-fatigue"])
    );
    expect(new Set(cases.map((c) => c.decoyKind))).toEqual(new Set(["locked-out", "traveller"]));
  });

  it("shows the person the log and the IT notes, never the conclusions", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      expect(signinBrief(signinCase(seed))).not.toMatch(
        /spray|brute|compromis|attacker|innocent|decoy/i
      );
    }
  });
});

describe("the triage picks are checked exactly", () => {
  const c = signinCase("seed-3");
  const assets = SUSPICIOUS_SIGNINS_ASSETS.triage!;
  const fields = assets.choices!(c);
  const label = (id: string) => fields.find((f) => f.id === id)!;
  const right = {
    attack: label("attack").options.find((o) => o.toLowerCase().includes(c.attack.split("-")[0]!))!,
    source: c.attackerIp,
    account: c.compromised,
    benign: c.decoy,
  };
  const cited = `From ${c.attackerIp}; ${c.compromised} fell at ${clock(c.compromisedAt)} UTC.`;
  const review = (choices: Record<string, string>, text = cited) =>
    reviewSubmission(assets.criteria as never, { text, choices }, c, { criteria: [] }).results;
  const level = (r: ReturnType<typeof review>, id: string) => r.find((x) => x.id === id)?.level;

  it("offers the case's own addresses and accounts", () => {
    expect(label("source").options).toEqual([...signinIps(c), "No single source"]);
    expect(label("account").options).toContain(c.compromised);
  });

  it("credits the right picks and a note that cites the log", () => {
    const r = review(right);
    for (const id of ["attack-kind", "source", "account", "benign", "evidence"]) {
      expect(level(r, id)).toBe("meets");
    }
  });

  it("isn't fooled by the right words in the writing: the picks decide", () => {
    const wrongUser = c.users.find((u) => u !== c.compromised && u !== c.decoy)!;
    const r = review(
      { ...right, account: wrongUser, benign: "None of them" },
      `${cited} ${c.decoy} is innocent.`
    );
    expect(level(r, "account")).toBe("not_yet");
    expect(level(r, "benign")).toBe("not_yet");
  });

  it("never gives the answer away in feedback", () => {
    const r = review(
      {
        attack: "No attack: ordinary activity",
        source: "No single source",
        account: "No account was taken over",
        benign: "None of them",
      },
      "Nothing happened."
    );
    const feedback = r.map((x) => x.feedback).join(" ");
    expect(feedback).not.toContain(c.attackerIp);
    expect(feedback).not.toContain(c.compromised.split("@")[0]!);
    expect(feedback).not.toContain(c.decoy.split("@")[0]!);
    expect(feedback).not.toContain(clock(c.compromisedAt));
  });

  it("fails picks copied from someone else's case", () => {
    const other = signinCase("someone-else");
    const r = review({ ...right, source: other.attackerIp, account: other.compromised });
    if (other.attackerIp !== c.attackerIp) expect(level(r, "source")).toBe("not_yet");
    if (other.compromised !== c.compromised) expect(level(r, "account")).toBe("not_yet");
  });

  it("asks for the exact address and time when the note doesn't cite them", () => {
    const r = review(right, "The attacker got in overnight from a VPS.");
    expect(level(r, "evidence")).toBe("not_yet");
    expect(r.find((x) => x.id === "evidence")!.feedback).toMatch(/source address.*time/);
  });
});

describe("the response and the report act on this incident", () => {
  const c = signinCase("seed-7");
  const check = (step: string, id: string, text: string) => {
    const k = SUSPICIOUS_SIGNINS_ASSETS[step]!.criteria.find((x) => x.id === id)!;
    return k.kind === "fact" ? k.check({ text, choices: {} }, c) : { met: false, seen: "" };
  };

  it("the first-hour plan must name the account and the address", () => {
    expect(
      check(
        "contain",
        "names-target",
        `Revoke sessions for ${c.compromised.split("@")[0]}, block ${c.attackerIp}.`
      ).met
    ).toBe(true);
    expect(
      check("contain", "names-target", "Revoke the user's sessions and block the IP.").met
    ).toBe(false);
  });

  it("the report's timeline must use the log's own times", () => {
    expect(
      check(
        "report",
        "timeline-times",
        `${clock(c.firstAttempt)} first attempt; ${clock(c.compromisedAt)} sign-in.`
      ).met
    ).toBe(true);
    expect(check("report", "timeline-times", "Overnight the account was taken over.").met).toBe(
      false
    );
  });

  it("example answers, shown only after a pass, are about this case", () => {
    for (const step of ["triage", "contain", "report"]) {
      expect(SUSPICIOUS_SIGNINS_ASSETS[step]!.exampleAnswer(c)).toContain(c.compromised);
    }
  });
});

describe("the hint ladder", () => {
  it("has three hints per step, none naming an account or an address", () => {
    for (const step of SECURITY_OPERATIONS_PACK.activities[0]!.steps) {
      const hints = SUSPICIOUS_SIGNINS_ASSETS[step.id]!.hints;
      expect(hints).toHaveLength(3);
      for (const hint of hints) {
        expect(hint).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|@/);
      }
    }
  });
});

describe("its own marking check (Codex review, 20 Oct 2026)", () => {
  it("is its own evaluation set, with the failures that matter in this field", async () => {
    const { activityRuntime } = await import("./index");
    const { signinsEvalCases } = await import("./security-operations.eval");
    const suite = activityRuntime("fadi.security-operations", "suspicious-sign-ins")!.evalSuite;
    expect(suite.activityId).toBe("suspicious-sign-ins");
    const cases = signinsEvalCases();
    expect(new Set(cases.map((c) => c.step))).toEqual(new Set(["triage", "contain", "report"]));
    for (const id of ["contain-overclaims", "contain-workaround", "report-false-certainty"]) {
      expect(cases.find((c) => c.id === id)?.expect).toBe("fail");
    }
  });

  it("good answers satisfy every exact check, so only the model's judgement decides them", async () => {
    const { signinsEvalCases, SIGNINS_EVAL_SEED } = await import("./security-operations.eval");
    const c = signinCase(SIGNINS_EVAL_SEED);
    for (const item of signinsEvalCases().filter((x) => x.kind === "good")) {
      const facts = SUSPICIOUS_SIGNINS_ASSETS[item.step]!.criteria.filter((k) => k.kind === "fact");
      for (const fact of facts) {
        const result =
          fact.kind === "fact"
            ? fact.check({ text: item.submission, choices: item.choices ?? {} }, c)
            : null;
        expect(result?.met, `${item.id} › ${fact.id}`).toBe(true);
      }
    }
  });

  it("the injections are refused before any model is asked", async () => {
    const { containsRubricGaming } = await import("../rubric");
    const { signinsEvalCases } = await import("./security-operations.eval");
    for (const item of signinsEvalCases().filter((x) => x.id.endsWith("injection"))) {
      expect(containsRubricGaming(item.submission), item.id).toBe(true);
    }
    for (const item of signinsEvalCases().filter((x) => x.kind === "good")) {
      expect(containsRubricGaming(item.submission), item.id).toBe(false);
    }
  });
});

describe("the evidence stops where the analyst picks the alert up", () => {
  it("states the cutoff and has no entry after it, for every seed", async () => {
    const { SIGNIN_CUTOFF } = await import("../sim/signin-case");
    for (const seed of SEEDS) {
      const c = signinCase(seed);
      expect(Math.max(...c.log.map((e) => e.minute))).toBeLessThanOrEqual(SIGNIN_CUTOFF);
      expect(signinBrief(c)).toContain(`You pick it up at ${clock(SIGNIN_CUTOFF)}`);
    }
  });

  it("the example report doesn't claim actions or results the log can't show", () => {
    const c = signinCase("seed-7");
    const report = SUSPICIOUS_SIGNINS_ASSETS.report!.exampleAnswer(c);
    expect(report).toMatch(/pending confirmation/);
    expect(report).toMatch(/not yet known/);
    expect(report).not.toMatch(/were revoked|was contained|no forwarding rules found/i);
    const contain = SUSPICIOUS_SIGNINS_ASSETS.contain!.exampleAnswer(c);
    expect(contain).not.toMatch(/app-specific|app password[^s]/i);
  });
});
