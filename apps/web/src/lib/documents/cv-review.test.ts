import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { clampScore, runCvReview, toVerdict } from "./cv-review";

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

describe("runCvReview", () => {
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
  const generate = {
    structured: async <T,>(_system: string, _user: string, schema: z.ZodType<T>): Promise<T> => {
      calls += 1;
      return schema.parse(rawPayload);
    },
  };

  it("refuses honestly without a JD or resume (no provider call spent)", async () => {
    calls = 0;
    const noJd = await runCvReview(generate, { jobTitle: "SOC Analyst", company: "X", jobDescription: " ", resumeText: "cv" });
    expect(noJd.ok).toBe(false);
    const noCv = await runCvReview(generate, { jobTitle: "SOC Analyst", company: "X", jobDescription: "jd", resumeText: "" });
    expect(noCv.ok).toBe(false);
    expect(calls).toBe(0);
  });

  it("normalises a messy provider payload into a clean review", async () => {
    const res = await runCvReview(generate, {
      jobTitle: "SOC Analyst",
      company: "X",
      jobDescription: "SIEM, incident response, Splunk",
      resumeText: "IT professional…",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.review.sections).toHaveLength(1); // empty section dropped
    expect(res.review.sections[0].verdict).toBe("critical");
    expect(res.review.atsScore).toBe(62); // "62" coerced
    expect(res.review.missingKeywords).toEqual(["SIEM", "Splunk"]); // trimmed
    expect(res.review.hireProbability.decision).toBe("maybe");
  });
});
