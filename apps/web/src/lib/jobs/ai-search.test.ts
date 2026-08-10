import { describe, expect, it } from "vitest";

import { applyIntentFilter, parseJobPrompt, parseSalaryK } from "./ai-search";

describe("applyIntentFilter", () => {
  const jobs = [
    { title: "Senior DevOps Engineer", description: "AWS, Terraform", salaryText: "€90k–€110k" },
    { title: "Crypto Trader", description: "blockchain desk", salaryText: "€120k" },
    { title: "Junior Cloud Engineer", description: "Azure", salaryText: "€45k" },
  ];

  it("keeps only jobs matching the keywords", () => {
    const out = applyIntentFilter(jobs, { keywords: ["devops", "cloud"] });
    expect(out.map((j) => j.title)).toEqual(["Senior DevOps Engineer", "Junior Cloud Engineer"]);
  });

  it("drops excluded terms", () => {
    const out = applyIntentFilter(jobs, { keywords: [], exclude: ["crypto"] });
    expect(out.some((j) => j.title === "Crypto Trader")).toBe(false);
  });

  it("drops jobs below the salary floor when it can read one", () => {
    const out = applyIntentFilter(jobs, { keywords: [], salaryMinK: 80 });
    expect(out.map((j) => j.title)).toEqual(["Senior DevOps Engineer", "Crypto Trader"]); // €45k dropped
  });

  it("keeps jobs whose salary can't be parsed (never over-filters)", () => {
    const out = applyIntentFilter([{ title: "Role", salaryText: "Competitive" }], { keywords: [], salaryMinK: 80 });
    expect(out).toHaveLength(1);
  });
});

describe("parseJobPrompt location backstop", () => {
  // No AI key in unit tests → the catch path runs, so these assert the deterministic
  // location parse + de-noised keywords that fix the "Ireland search → US results" bug.
  it("extracts the country even when the model is unavailable", async () => {
    const intent = await parseJobPrompt("search for graduate roles for IT in Ireland");
    expect(intent.country).toBe("ie");
  });

  it("resolves a city and its country", async () => {
    const intent = await parseJobPrompt("IT jobs in Dublin");
    expect(intent.country).toBe("ie");
    expect(intent.city).toBe("Dublin");
  });

  it("does not turn stopwords/filler into keywords", async () => {
    const intent = await parseJobPrompt("search for graduate roles for IT in Ireland");
    expect(intent.keywords).not.toContain("for");
    expect(intent.keywords).not.toContain("roles");
    expect(intent.keywords.map((k) => k.toLowerCase())).not.toContain("ireland");
  });
});

describe("parseSalaryK", () => {
  it("reads common salary formats to the lower bound (in thousands)", () => {
    expect(parseSalaryK("€80k–€100k")).toBe(80);
    expect(parseSalaryK("$150,000")).toBe(150);
    expect(parseSalaryK("Competitive")).toBeNull();
    expect(parseSalaryK(null)).toBeNull();
  });
});
