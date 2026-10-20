import { describe, expect, it } from "vitest";

import { resolveApplicationJobContext } from "./job-context";

describe("resolveApplicationJobContext", () => {
  const job = {
    title: "Generic title",
    company: "Board company",
    description: "Description captured by the job board",
    url: "https://board.example/job",
  };

  it("uses the saved application posting when one exists", () => {
    expect(
      resolveApplicationJobContext(job, {
        title: "Application Security Engineer",
        company: "Intercom",
        jobDescription: "The exact description pasted for this application",
        url: "https://company.example/job",
      })
    ).toEqual({
      title: "Application Security Engineer",
      company: "Intercom",
      description: "The exact description pasted for this application",
      url: "https://company.example/job",
    });
  });

  it("falls back field by field when saved values are blank", () => {
    expect(
      resolveApplicationJobContext(job, {
        title: " ",
        company: "",
        jobDescription: "  ",
        url: null,
      })
    ).toEqual(job);
  });

  it("returns a missing description honestly", () => {
    expect(
      resolveApplicationJobContext({ title: "Role", company: "Company", description: null }, null)
        .description
    ).toBeNull();
  });
});
