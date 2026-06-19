import { describe, expect, it } from "vitest";

import { formatPrepQuestion, summarizeStoriesForPrep, type PrepQuestion } from "./jd-prep";

describe("summarizeStoriesForPrep", () => {
  it("says so honestly when there are no saved stories", () => {
    expect(summarizeStoriesForPrep([])).toMatch(/no saved stories/i);
  });

  it("renders a compact, competency-tagged list", () => {
    const out = summarizeStoriesForPrep([
      { title: "Led the migration", competencies: ["leadership", "ownership"], result: "Cut cost 40%" },
    ]);
    expect(out).toContain("Led the migration");
    expect(out).toContain("leadership, ownership");
    expect(out).toContain("Cut cost 40%");
  });
});

describe("formatPrepQuestion", () => {
  const base: PrepQuestion = {
    question: "Tell me about a time you led under pressure.",
    competency: "leadership",
    situation: "A stalled migration",
    task: "Get it shipped in 3 weeks",
    action: "Re-scoped and rallied the team",
    result: "Shipped on time, cut cost 40%",
  };

  it("renders the STAR shape", () => {
    const out = formatPrepQuestion(base);
    expect(out).toContain("Q: Tell me about a time you led under pressure.");
    expect(out).toContain("S: A stalled migration");
    expect(out).toContain("R: Shipped on time, cut cost 40%");
  });

  it("flags when no real example exists yet (never fabricated)", () => {
    const out = formatPrepQuestion({ ...base, needsRealExample: true });
    expect(out).toMatch(/prepare one; don't invent/i);
  });
});
