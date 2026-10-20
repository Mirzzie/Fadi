import { describe, expect, it, vi } from "vitest";

import {
  analyzeTranscript,
  countryInterviewNorms,
  INTERVIEWER_PERSONAS,
  interviewQuestionCount,
  interviewStageGuide,
  overallFromScores,
  personaStyle,
  scoreInterviewAnswer,
  transcriptNote,
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

describe("interview setup", () => {
  it("turns a user-recognizable stage into question guidance", () => {
    expect(interviewStageGuide("recruiter")).toMatch(/motivation|career narrative/i);
    expect(interviewStageGuide("technical")).toMatch(/troubleshooting|trade-offs/i);
    expect(interviewStageGuide("behavioral")).toMatch(/STAR|competenc/i);
    expect(interviewStageGuide("unknown")).toMatch(/hiring-manager/i);
  });

  it("uses only the two promised practice lengths", () => {
    expect(interviewQuestionCount(10)).toBe(4);
    expect(interviewQuestionCount(20)).toBe(7);
    expect(interviewQuestionCount(45)).toBe(4);
  });
});

describe("analyzeTranscript", () => {
  it("counts transcript words without inventing audio timing", () => {
    const stats = analyzeTranscript("I led the team and we shipped on time.");
    expect(stats.wordCount).toBe(9);
    expect(stats).not.toHaveProperty("estSeconds");
    expect(stats).not.toHaveProperty("pacing");
  });

  it("flags possible filler phrases in the transcript", () => {
    const stats = analyzeTranscript(
      "So um I basically like led the team you know and uh shipped it."
    );
    expect(stats.fillerCount).toBeGreaterThanOrEqual(3);
    expect(stats.fillerWords).toEqual(expect.arrayContaining(["um", "basically"]));
  });

  it("describes only facts available from text", () => {
    const note = transcriptNote(
      analyzeTranscript("So um like uh you know basically I mean kind of.")
    );
    expect(note).toMatch(/words in the transcript|filler phrases/i);
    expect(note).not.toMatch(/seconds|pace|slow down|good length/i);
  });
});

describe("answer review fallback", () => {
  it("does not present a missing AI review as a zero content score", async () => {
    vi.doMock("@/lib/ai/user-generate", () => ({
      getUserDocGenerate: async () => null,
    }));

    const result = await scoreInterviewAnswer("user-1", {
      question: "Tell me about a time you resolved an incident.",
      answer: "I checked the logs, found the failed service, restarted it, and documented the fix.",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.score.overall).toBeNull();
    expect(result.score.scores).toBeNull();
    expect(result.score.transcriptNote).toMatch(/words in the transcript/i);
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
    const structured = overallFromScores({
      structure: 5,
      specificity: 5,
      relevance: 0,
      concision: 0,
    });
    const polished = overallFromScores({
      structure: 0,
      specificity: 0,
      relevance: 5,
      concision: 5,
    });
    expect(structured).toBeGreaterThan(polished);
    expect(overallFromScores({ structure: 5, specificity: 5, relevance: 5, concision: 5 })).toBe(5);
  });
});
