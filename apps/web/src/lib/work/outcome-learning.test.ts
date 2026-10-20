import { describe, expect, it } from "vitest";

import { practiceFromInterview, practiceFromRejection } from "./outcome-learning";

const review = (scores: Record<string, number>, improvements: string[] = []) => ({
  review: { scores, improvements },
});

describe("practiceFromInterview", () => {
  it("proposes the weakest dimension across the session, with the review's own advice", () => {
    const proposal = practiceFromInterview("SOC Analyst", [
      review({ structure: 4, specificity: 2, relevance: 4, concision: 4 }, [
        "Name the tool you used.",
      ]),
      review({ structure: 4, specificity: 3, relevance: 3, concision: 5 }),
    ]);
    expect(proposal?.title).toMatch(/what you did/);
    expect(proposal?.reason).toContain("specificity averaged 2.5 of 5");
    expect(proposal?.reason).toContain("Name the tool you used.");
  });

  it("proposes nothing when every dimension is holding up", () => {
    expect(
      practiceFromInterview("SOC Analyst", [
        review({ structure: 4, specificity: 4, relevance: 5, concision: 4 }),
      ])
    ).toBeNull();
  });

  it("proposes nothing from a session with no scored answers", () => {
    expect(practiceFromInterview("SOC Analyst", [{}, { review: { scores: null } }])).toBeNull();
  });
});

describe("practiceFromRejection", () => {
  const base = { title: "SOC Analyst", company: "Acme" };

  it("uses the person's own next step first", () => {
    expect(
      practiceFromRejection({
        ...base,
        nextAction: "  Build a Splunk dashboard  ",
        sharperNext: "x",
      }).title
    ).toBe("Build a Splunk dashboard");
  });

  it("falls back to the autopsy's suggestion", () => {
    expect(practiceFromRejection({ ...base, sharperNext: "Lead with the SIEM lab" }).title).toBe(
      "Lead with the SIEM lab"
    );
  });

  it("matches the task to the stage it ended at", () => {
    expect(practiceFromRejection({ ...base, stage: "interview" }).title).toMatch(
      /practice interview/
    );
    expect(practiceFromRejection({ ...base, stage: "keyword" }).title).toMatch(/résumé/);
    expect(practiceFromRejection(base).title).toMatch(/what you would change/);
  });
});
