import { describe, expect, it } from "vitest";

import { DOC_GUIDANCE, lengthStatus, wordCount } from "./doc-guidance";

describe("doc-guidance", () => {
  it("counts words robustly", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("  one   two\nthree ")).toBe(3);
  });

  it("classifies length against a doc's target range", () => {
    const cl = DOC_GUIDANCE.cover_letter!.words; // 250–400
    expect(lengthStatus(0, cl)).toBe("empty");
    expect(lengthStatus(120, cl)).toBe("short");
    expect(lengthStatus(300, cl)).toBe("ok");
    expect(lengthStatus(500, cl)).toBe("long");
  });

  it("has distinct, sourced guidance per prose document type", () => {
    expect(DOC_GUIDANCE.cover_letter?.words).toMatchObject({ min: 250, max: 400 });
    expect(DOC_GUIDANCE.email?.words).toMatchObject({ min: 50, max: 150 });
    expect(DOC_GUIDANCE.value_proposition?.words).toMatchObject({ min: 120, max: 180 });
    for (const kind of ["cover_letter", "email", "value_proposition"] as const) {
      expect(DOC_GUIDANCE[kind]?.sources).toBeTruthy();
      expect(DOC_GUIDANCE[kind]?.tips.length).toBeGreaterThan(0);
    }
  });
});
