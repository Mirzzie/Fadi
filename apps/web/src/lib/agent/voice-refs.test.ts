import { describe, expect, it } from "vitest";

import { positionSaid, refsFrom, resolvePosition, withPositionsResolved } from "./voice-refs";

const jobs = refsFrom({
  where: "Dublin",
  jobs: [
    { title: "SOC Analyst", company: "Acme" },
    { title: "Security Engineer", company: "Stripe" },
    { title: "IT Support", company: "Globex" },
  ],
})!;

describe("refsFrom", () => {
  it("keeps the list in the order it was said", () => {
    expect(jobs.map((r) => r.label)).toEqual([
      "SOC Analyst at Acme",
      "Security Engineer at Stripe",
      "IT Support at Globex",
    ]);
    expect(refsFrom({ flagships: [{ title: "Phishing triage" }] })).toEqual([
      { label: "Phishing triage" },
    ]);
  });

  it("is null when nothing was listed, so the previous list stays", () => {
    expect(refsFrom({ jobs: [] })).toBeNull();
    expect(refsFrom({ id: "x" })).toBeNull();
    expect(refsFrom(undefined)).toBeNull();
  });
});

describe("resolvePosition", () => {
  it.each([
    ["the second one", "Security Engineer at Stripe"],
    ["second", "Security Engineer at Stripe"],
    ["the 2nd role", "Security Engineer at Stripe"],
    ["number 3", "IT Support at Globex"],
    ["the last one", "IT Support at Globex"],
    ["the first job.", "SOC Analyst at Acme"],
  ])("%s → %s", (said, label) => {
    expect(resolvePosition(said, jobs)).toBe(label);
  });

  it("leaves a real name alone, even one containing a position word", () => {
    expect(resolvePosition("the second Stripe role", jobs)).toBeNull();
    expect(resolvePosition("Stripe", jobs)).toBeNull();
  });

  it("does not invent a position that was not said", () => {
    expect(resolvePosition("the fifth one", jobs)).toBeNull();
    expect(resolvePosition("number 0", jobs)).toBeNull();
    expect(resolvePosition("second", [])).toBeNull();
  });

  it("takes 'that one' only when exactly one thing was said", () => {
    expect(resolvePosition("that one", jobs)).toBeNull();
    expect(resolvePosition("that one", [{ label: "Phishing triage" }])).toBe("Phishing triage");
  });
});

describe("withPositionsResolved", () => {
  it("replaces only the arguments that are bare positions", () => {
    expect(withPositionsResolved({ job: "the second one", note: "keep it", n: 2 }, jobs)).toEqual({
      job: "Security Engineer at Stripe",
      note: "keep it",
      n: 2,
    });
  });
});

describe("positionSaid", () => {
  it("finds the position in what the person said", () => {
    expect(positionSaid("save the second one", jobs)).toBe("Security Engineer at Stripe");
    expect(positionSaid("Fadi, drop the last role please", jobs)).toBe("IT Support at Globex");
    expect(positionSaid("save number 1", jobs)).toBe("SOC Analyst at Acme");
  });

  it("is not fooled by ordinary words", () => {
    expect(positionSaid("I got a second interview with Stripe", jobs)).toBeNull();
    expect(positionSaid("save the Stripe role", jobs)).toBeNull();
    expect(positionSaid("save the second one", [])).toBeNull();
  });
});
