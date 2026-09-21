import { describe, expect, it } from "vitest";

import { hasBlockingFindings, truthCheck } from "./truth-gate";

const corpus = [
  "Junior DevOps Engineer Trainee at Crozait Technologies (2024).",
  "AWS Cloud Intern at F13 Technologies (2023).",
  "Built CI/CD pipelines with GitHub Actions; deployed on Linux.",
  "Reduced build time by 30% on the internship project.",
].join("\n");

describe("truthCheck — unsupported numbers (block)", () => {
  it("flags an invented metric that is nowhere in the record", () => {
    const f = truthCheck("Increased revenue by 45% and cut costs $200k.", { corpus });
    const blocked = f.filter((x) => x.category === "unsupported-number");
    expect(blocked.map((x) => x.offending)).toEqual(expect.arrayContaining(["45%", "$200k"]));
    expect(hasBlockingFindings(f)).toBe(true);
  });

  it("does NOT flag a metric that IS in the record", () => {
    const f = truthCheck("Reduced build time by 30% using GitHub Actions.", { corpus });
    expect(f.filter((x) => x.category === "unsupported-number")).toHaveLength(0);
  });
});

describe("truthCheck — seniority inflation (warn)", () => {
  it("flags senior language on an early-career record", () => {
    const f = truthCheck("Senior DevOps Lead responsible for the platform.", { corpus });
    expect(f.some((x) => x.category === "seniority-inflation")).toBe(true);
    expect(hasBlockingFindings(f)).toBe(false); // a warning, not a block
  });

  it("does not flag senior language when the record already supports it", () => {
    const f = truthCheck("Senior Engineer.", { corpus: "Senior Engineer, 8 years, led teams." });
    expect(f.some((x) => x.category === "seniority-inflation")).toBe(false);
  });
});

describe("truthCheck — JD-only terms (warn)", () => {
  it("flags a skill that came from the JD but isn't in the record", () => {
    const jd = "We need strong Kubernetes and Terraform experience.";
    const f = truthCheck("Skilled in Kubernetes and CI/CD.", { corpus, jobDescription: jd });
    const terms = f.filter((x) => x.category === "jd-only-term").map((x) => x.offending);
    expect(terms).toContain("kubernetes");
    // "ci/cd" is in the record → not flagged; generic words never flagged.
    expect(terms).not.toContain("strong");
  });

  it("is silent when there is no job description", () => {
    expect(truthCheck("Skilled in Kubernetes.", { corpus })).toHaveLength(0);
  });
});

describe("truthCheck — a genuinely grounded draft passes clean", () => {
  it("returns no findings for a draft entirely backed by the record", () => {
    const jd = "GitHub Actions and Linux required.";
    const f = truthCheck(
      "DevOps trainee who built CI/CD pipelines with GitHub Actions and deployed on Linux.",
      { corpus, jobDescription: jd }
    );
    expect(f).toHaveLength(0);
  });
});

describe("the job-description check flags terms, not English", () => {
  const jd = "We are building a regular programme where each graduate delivers real consulting work with Kubernetes.";
  const corpus = "IT support technician. Windows, Microsoft 365, Linux.";

  it("THE REPORTED NOISE: ordinary words are not things to justify", () => {
    // Seen on a real EY cover letter, 20 Sep: twelve warnings, including "while", "also",
    // "each", "over", "regular" and "real".
    const draft = "While building each regular part of the real work, I also delivered over time.";
    const flagged = truthCheck(draft, { corpus, jobDescription: jd }).filter(
      (f) => f.category === "jd-only-term"
    );
    expect(flagged.map((f) => f.offending)).toEqual([]);
  });

  it("still flags a real term borrowed from the posting", () => {
    const draft = "I ran Kubernetes clusters in production.";
    const flagged = truthCheck(draft, { corpus, jobDescription: jd }).filter(
      (f) => f.category === "jd-only-term"
    );
    expect(flagged.map((f) => f.offending)).toContain("kubernetes");
  });
});

describe("a term that ends a sentence is still the same term", () => {
  it("matches a posting word written before a full stop", () => {
    // "…with Kubernetes." tokenised as "kubernetes." and matched nothing.
    const flagged = truthCheck("I ran Kubernetes clusters.", {
      corpus: "IT support technician.",
      jobDescription: "You will work with Kubernetes.",
    }).filter((f) => f.category === "jd-only-term");
    expect(flagged.map((f) => f.offending)).toContain("kubernetes");
  });

  it("keeps a dot inside a technology name", () => {
    const flagged = truthCheck("I build with Node.js daily.", {
      corpus: "IT support technician.",
      jobDescription: "Our stack is Node.js and Postgres.",
    }).filter((f) => f.category === "jd-only-term");
    expect(flagged.map((f) => f.offending)).toContain("node.js");
  });
});
