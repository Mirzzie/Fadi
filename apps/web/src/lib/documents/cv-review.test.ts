import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { clampScore, reviewToGuidance, runDocReview, toVerdict, type CvReview } from "./cv-review";

describe("toVerdict", () => {
  it("normalises provider free-text onto the four verdicts", () => {
    expect(toVerdict("CRITICAL")).toBe("critical");
    expect(toVerdict("🔴 critical — will get binned")).toBe("critical");
    expect(toVerdict("Strength")).toBe("strength");
    expect(toVerdict("blue / advantage")).toBe("advantage");
    expect(toVerdict("needs reframing")).toBe("reframe");
    expect(toVerdict(undefined)).toBe("reframe"); // safe default
  });
});

describe("clampScore", () => {
  it("clamps into 0–100 and survives junk", () => {
    expect(clampScore(72.6)).toBe(73);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(140)).toBe(100);
    expect(clampScore(NaN)).toBe(0);
  });
});

describe("reviewToGuidance", () => {
  const review: CvReview = {
    sections: [
      { name: "Summary", jdDemands: "", cvSays: "", diagnosis: "Generic.", verdict: "critical", rewrite: "SOC-focused… [ADD REAL NUMBER]" },
      { name: "Skills", jdDemands: "", cvSays: "", diagnosis: "Fine.", verdict: "strength", rewrite: "unchanged" },
    ],
    atsScore: 60,
    missingKeywords: [],
    sixSecondImpression: "",
    topCriticalFixes: ["Rewrite the summary"],
    quickWins: ["Reorder sections"],
    hireProbability: { decision: "maybe", reason: "" },
  };

  it("includes fixes + non-strength rewrites, skips strengths, and caps length", () => {
    const g = reviewToGuidance(review);
    expect(g).toContain("MUST FIX");
    expect(g).toContain("Rewrite the summary");
    expect(g).toContain("SUMMARY (critical)");
    expect(g).not.toContain("SKILLS"); // strengths aren't re-litigated
    expect(reviewToGuidance(review, 20).length).toBe(20); // hard cap
  });
});

describe("runDocReview", () => {
  // A deliberately MESSY provider payload — string score, emoji verdicts, padded
  // keywords, an empty section — parsed through the real (tolerant) schema, exactly
  // like a live provider response would be.
  const rawPayload = {
    sections: [
      {
        name: "Professional Summary",
        jdDemands: "SIEM, incident response",
        cvSays: "IT professional with strong technical skills",
        diagnosis: "Generic — no role, no metric, could be anyone.",
        verdict: "red critical",
        rewrite: "SOC-focused IT professional… [ADD REAL NUMBER] incidents triaged.",
      },
      { name: "", jdDemands: "", cvSays: "", diagnosis: "", verdict: "", rewrite: "" }, // dropped
    ],
    atsScore: "62",
    missingKeywords: ["SIEM", " Splunk "],
    sixSecondImpression: "Reads as generic IT support, not SOC.",
    topCriticalFixes: ["Rewrite the summary around SOC evidence"],
    quickWins: ["Move certifications above skills"],
    hireDecision: "Maybe — borderline",
    hireReason: "Right raw material, wrong framing.",
  };

  let calls = 0;
  let lastSystem = "";
  const generate = {
    structured: async <T,>(system: string, _user: string, schema: z.ZodType<T>): Promise<T> => {
      calls += 1;
      lastSystem = system;
      return schema.parse(rawPayload);
    },
  };

  it("refuses honestly without a JD or document (no provider call spent)", async () => {
    calls = 0;
    const noJd = await runDocReview(generate, { kind: "resume", jobTitle: "SOC Analyst", company: "X", jobDescription: " ", docText: "cv" });
    expect(noJd.ok).toBe(false);
    const noDoc = await runDocReview(generate, { kind: "cover_letter", jobTitle: "SOC Analyst", company: "X", jobDescription: "jd", docText: "" });
    expect(noDoc.ok).toBe(false);
    if (!noDoc.ok) expect(noDoc.message).toContain("cover letter"); // kind-aware message
    expect(calls).toBe(0);
  });

  it("normalises a messy provider payload into a clean review", async () => {
    const res = await runDocReview(generate, {
      kind: "resume",
      jobTitle: "SOC Analyst",
      company: "X",
      jobDescription: "SIEM, incident response, Splunk",
      docText: "IT professional…",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.review.sections).toHaveLength(1); // empty section dropped
    expect(res.review.sections[0].verdict).toBe("critical");
    expect(res.review.atsScore).toBe(62); // "62" coerced
    expect(res.review.missingKeywords).toEqual(["SIEM", "Splunk"]); // trimmed
    expect(res.review.hireProbability.decision).toBe("maybe");
  });

  it("frames the prompt per kind with the recruiter rubric", async () => {
    await runDocReview(generate, {
      kind: "email",
      jobTitle: "SOC Analyst",
      company: "X",
      jobDescription: "jd",
      docText: "Hi — quick note…",
    });
    expect(lastSystem).toContain("cold email");
    expect(lastSystem).toContain("subject line"); // kind-specific sections
    expect(lastSystem).toContain("50–150"); // rubric from DOC_GUIDANCE

    await runDocReview(generate, {
      kind: "cover_letter",
      jobTitle: "SOC Analyst",
      company: "X",
      jobDescription: "jd",
      docText: "Dear team…",
    });
    expect(lastSystem).toContain("cover letter");
    expect(lastSystem).toContain("250–400");
  });
});
