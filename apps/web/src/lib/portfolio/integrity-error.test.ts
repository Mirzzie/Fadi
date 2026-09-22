import { describe, expect, it } from "vitest";

import { readableAiError } from "./integrity";

/**
 * A VALIDATION DUMP IS NOT A MESSAGE.
 *
 * The owner's CMS showed, under "Fadi found no contradictions, timeline errors, or duplicates":
 *   [ { "expected": "array", "code": "invalid_type", "path": [ "findings" ], … } ]
 * because a Zod error stringifies to its own issue list and that went straight to the screen.
 */
describe("readableAiError", () => {
  it("replaces a validation dump with plain English", () => {
    const zodish = new Error(
      '[\n  {\n    "expected": "array",\n    "code": "invalid_type",\n    "path": [ "findings" ]\n  }\n]'
    );
    expect(readableAiError(zodish)).toBe(
      "Fadi's AI answered in a shape Fadi couldn't read, so nothing was checked. Try again."
    );
  });

  it("passes on a rate limit in words the person can act on", () => {
    expect(readableAiError(new Error("429 Too Many Requests"))).toContain("rate-limiting");
  });

  it("keeps an ordinary provider message", () => {
    expect(readableAiError(new Error("Invalid API key"))).toBe("Invalid API key");
  });

  it("says something when there is nothing to say", () => {
    expect(readableAiError(undefined)).toContain("couldn't run");
  });
});
