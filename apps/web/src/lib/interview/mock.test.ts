import { describe, expect, it } from "vitest";

import {
  analyzeDelivery,
  countryInterviewNorms,
  deliveryNote,
  INTERVIEWER_PERSONAS,
  overallFromScores,
  personaStyle,
} from "./mock";

describe("countryInterviewNorms", () => {
  it("returns country-specific guidance", () => {
    expect(countryInterviewNorms("United States")).toMatch(/STAR|tell me about a time/i);
    expect(countryInterviewNorms("Germany")).toMatch(/structured|precision/i);
    expect(countryInterviewNorms("Japan")).toMatch(/self-introduction|jikoshoukai/i);
    expect(countryInterviewNorms("India")).toMatch(/fundamentals|technical/i);
  });

  it("falls back to a general style for unknown/blank countries", () => {
    expect(countryInterviewNorms(null)).toMatch(/general professional/i);
    expect(countryInterviewNorms("Atlantis")).toMatch(/general professional/i);
  });
});

describe("analyzeDelivery", () => {
  it("counts words and estimates duration", () => {
    const d = analyzeDelivery("I led the team and we shipped on time.");
    expect(d.wordCount).toBe(9);
    expect(d.estSeconds).toBeGreaterThan(0);
  });

  it("flags filler words", () => {
    const d = analyzeDelivery("So um I basically like led the team you know and uh shipped it.");
    expect(d.fillerCount).toBeGreaterThanOrEqual(3);
    expect(d.fillerWords).toEqual(expect.arrayContaining(["um", "basically"]));
  });

  it("labels pacing by length", () => {
    expect(analyzeDelivery("Too short.").pacing).toBe("short");
    expect(analyzeDelivery(Array(120).fill("word").join(" ")).pacing).toBe("good");
    expect(analyzeDelivery(Array(300).fill("word").join(" ")).pacing).toBe("long");
  });

  it("deliveryNote calls out length and heavy filler", () => {
    const note = deliveryNote(analyzeDelivery("So um like uh you know basically I mean kind of."));
    expect(note).toMatch(/short|filler/i);
  });
});

describe("interviewer personas (style, not impersonation)", () => {
  it("injects a known persona's style and the 'visionary' never impersonates a real person", () => {
    expect(personaStyle("recruiter")).toMatch(/friendly recruiter/i);
    expect(personaStyle("visionary")).toMatch(/WITHOUT impersonating any real person/i);
  });
  it("returns nothing for an unknown/missing persona (graceful)", () => {
    expect(personaStyle("elon_musk")).toBe("");
    expect(personaStyle(null)).toBe("");
  });
  it("every persona is domain-agnostic (no named real people or tech-only roles)", () => {
    for (const p of INTERVIEWER_PERSONAS) {
      expect(p.style.toLowerCase()).not.toMatch(/musk|jobs|bezos|software engineer/);
    }
  });
});

describe("overallFromScores", () => {
  it("weights structure and specificity most", () => {
    const structured = overallFromScores({ structure: 5, specificity: 5, relevance: 0, concision: 0 });
    const polished = overallFromScores({ structure: 0, specificity: 0, relevance: 5, concision: 5 });
    expect(structured).toBeGreaterThan(polished);
    expect(overallFromScores({ structure: 5, specificity: 5, relevance: 5, concision: 5 })).toBe(5);
  });
});
