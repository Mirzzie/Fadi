import { describe, expect, it } from "vitest";

import { toSuggestionKind } from "./suggest";

/**
 * `toSuggestionKind` normalises a provider's free-text kind into the three the UI
 * understands. Same class as `normKind` in the evidence pool (which had a null bug):
 * an unhandled null or an unmatched string must degrade to a safe default, never crash
 * or mislabel. Pure.
 */
describe("toSuggestionKind", () => {
  it("classifies certifications", () => {
    expect(toSuggestionKind("certification")).toBe("certification");
    expect(toSuggestionKind("AWS Cert")).toBe("certification");
  });

  it("classifies courses/tutorials/videos as course", () => {
    expect(toSuggestionKind("course")).toBe("course");
    expect(toSuggestionKind("video tutorial")).toBe("course");
    expect(toSuggestionKind("YouTube video")).toBe("course");
  });

  it("defaults anything else — including undefined — to project", () => {
    // A build-something suggestion is the safe default: it never sends the user to buy
    // a cert or course they didn't ask for.
    expect(toSuggestionKind("project")).toBe("project");
    expect(toSuggestionKind("something novel")).toBe("project");
    expect(toSuggestionKind("")).toBe("project");
    expect(toSuggestionKind(undefined)).toBe("project");
  });

  it("is case-insensitive", () => {
    expect(toSuggestionKind("CERTIFICATION")).toBe("certification");
    expect(toSuggestionKind("Course")).toBe("course");
  });
});
