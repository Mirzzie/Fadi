import { describe, expect, it } from "vitest";

import { applyIntentFilter, parseSalaryK } from "./ai-search";

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

describe("parseSalaryK", () => {
  it("reads common salary formats to the lower bound (in thousands)", () => {
    expect(parseSalaryK("€80k–€100k")).toBe(80);
    expect(parseSalaryK("$150,000")).toBe(150);
    expect(parseSalaryK("Competitive")).toBeNull();
    expect(parseSalaryK(null)).toBeNull();
  });
});
