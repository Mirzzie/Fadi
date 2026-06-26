import { describe, expect, it } from "vitest";

import { formatBrief, type CompanyBrief } from "./company-brief";

const brief: CompanyBrief = {
  whatTheyDo: "They build payments infrastructure for online businesses.",
  roleFocus: "Own reliability of the payments API.",
  industryContext: "Fintech is consolidating around platform players.",
  smartQuestions: ["How do you measure on-call health?", "What's the biggest reliability risk this year?"],
  talkingPoints: ["Your migration cut incidents 40% — maps to their reliability focus."],
  recencyCaveat: "I can't see today's news — verify recent announcements before you go.",
};

describe("formatBrief", () => {
  it("renders the understanding, questions, talking points, and the honesty caveat", () => {
    const out = formatBrief(brief);
    expect(out).toContain("What they do: They build payments");
    expect(out).toContain("This role: Own reliability");
    expect(out).toContain("Smart questions to ask:");
    expect(out).toContain("How do you measure on-call health?");
    expect(out).toContain("Your talking points:");
    expect(out).toMatch(/can't see today's news/i); // never presents stale facts as current
  });
});
