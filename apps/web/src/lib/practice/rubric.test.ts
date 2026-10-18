import { describe, expect, it } from "vitest";

import { quoteIsGenuine, reviewSubmission, type Criterion } from "./rubric";

const quality: Criterion<null> = {
  id: "evidence",
  kind: "quality",
  label: "Backs judgements with figures",
  meets: "Uses two concrete figures.",
  strong: "Weighs them.",
};

describe("the rubric adapter", () => {
  const submission = "Northwind's weekly active users fell 58% and four tickets are past SLA.";

  it("accepts praise only with a genuine quote from the submission", () => {
    expect(quoteIsGenuine("weekly active users fell 58%", submission)).toBe(true);
    expect(quoteIsGenuine("usage fell by more than half", submission)).toBe(false);
    expect(quoteIsGenuine("fell", submission)).toBe(false); // too short to mean anything
  });

  it("turns an unsupported 'meets' back into 'not yet'", () => {
    const review = reviewSubmission([quality], submission, null, {
      criteria: [
        { id: "evidence", level: "strong", quote: "a quote that is not there", feedback: "Great." },
      ],
    });
    expect(review.results[0]).toMatchObject({ level: "not_yet", quote: null });
    expect(review.verdict).toBe("fail");
  });

  it("passes only when every criterion meets the bar", () => {
    const pass = reviewSubmission([quality], submission, null, {
      criteria: [
        { id: "evidence", level: "meets", quote: "four tickets are past SLA", feedback: "Good." },
      ],
    });
    expect(pass).toMatchObject({ verdict: "pass", met: 1, total: 1 });
    const missing = reviewSubmission([quality], submission, null, null);
    expect(missing.verdict).toBe("fail");
  });
});
