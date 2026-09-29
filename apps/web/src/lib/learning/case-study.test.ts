import { describe, expect, it } from "vitest";

import {
  availableAngles,
  caseStudyReadme,
  readReflection,
  walkthroughOutline,
  withReflection,
  type CaseStudyInput,
} from "./case-study";

const detail = withReflection("Built a three-tier AWS network with Terraform.", {
  decision:
    "Kept the database in a private subnet with no NAT, trading patching ease for exposure.",
  wentWrong:
    "The first IAM policy allowed s3:*; Access Analyzer flagged it and I scoped it to one bucket.",
});

const base: CaseStudyInput = {
  title: "Secure three-tier AWS network",
  kind: "project",
  scenario: "A startup's single flat VPC exposes its database to the internet.",
  detail,
  results: [
    { title: "Apply the Terraform plan", proof: "checked", result: "12 resources created" },
  ],
  steps: ["Write the VPC module", "Apply the Terraform plan"],
};

describe("the record's reflection", () => {
  it("round-trips the decision and the mistake through the saved text", () => {
    const read = readReflection(detail);
    expect(read.body).toBe("Built a three-tier AWS network with Terraform.");
    expect(read.decision).toMatch(/private subnet/);
    expect(read.wentWrong).toMatch(/Access Analyzer/);
  });

  it("reads an older record with neither as all body", () => {
    expect(readReflection("Just a summary.")).toEqual({
      body: "Just a summary.",
      decision: "",
      wentWrong: "",
    });
  });
});

describe("caseStudyReadme", () => {
  it("answers the two-minute questions in order: problem, work, proof, decision, mistake", () => {
    const md = caseStudyReadme(base);
    const order = [
      "## The problem",
      "## What I did",
      "## What it shows",
      "## Key decision",
      "## What went wrong",
    ];
    const at = order.map((h) => md.indexOf(h));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(md).toContain("12 resources created _(checked)_");
  });

  it("leaves out a section with nothing true to say instead of a placeholder", () => {
    const md = caseStudyReadme({ ...base, scenario: null, detail: "Built it." });
    expect(md).not.toContain("## The problem");
    expect(md).not.toContain("## Key decision");
    expect(md).not.toMatch(/TODO|add your|placeholder/i);
  });
});

describe("walkthroughOutline", () => {
  it("fits five minutes and only says what the record holds", () => {
    const beats = walkthroughOutline(base);
    expect(beats[0]).toEqual({ at: "0:00", say: expect.stringMatching(/^The problem/) });
    expect(beats.some((b) => b.say.includes("Access Analyzer"))).toBe(true);
    const thin = walkthroughOutline({ ...base, scenario: null, detail: "Built it.", results: [] });
    expect(thin.some((b) => /decision|went wrong/i.test(b.say))).toBe(false);
  });
});

describe("availableAngles", () => {
  it("offers the mistake post only when a mistake or decision was recorded", () => {
    expect(availableAngles(detail, "project")).toEqual(["problem", "build", "mistake", "result"]);
    expect(availableAngles("Built it.", "project")).toEqual(["problem", "build", "result"]);
    expect(availableAngles(detail, "course")).toEqual(["result"]);
  });
});

describe("caseStudyReadme without repetition", () => {
  it("does not list a result the summary already says", () => {
    const md = caseStudyReadme({
      ...base,
      detail: "- Apply the Terraform plan: 12 resources created",
    });
    expect(md).not.toContain("## What it shows");
  });
});
