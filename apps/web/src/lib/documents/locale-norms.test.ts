import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE_NORM, resolveLocaleNorm } from "./locale-norms";

describe("resolveLocaleNorm", () => {
  it("maps a free-text location to the right market", () => {
    expect(resolveLocaleNorm("Dublin, Ireland").code).toBe("IE");
    expect(resolveLocaleNorm("Berlin, Germany").code).toBe("DE");
    expect(resolveLocaleNorm("San Francisco, CA, USA").code).toBe("US");
    expect(resolveLocaleNorm("Tokyo, Japan").code).toBe("JP");
  });

  it("captures market-defining norms", () => {
    const us = resolveLocaleNorm("New York, United States");
    expect(us.photo).toBe("avoid");
    expect(us.personal.dob).toBe(false);

    const gulf = resolveLocaleNorm("Dubai, UAE");
    expect(gulf.photo).toBe("expected");
    expect(gulf.workAuthField).toBe(true);

    const de = resolveLocaleNorm("Munich, Germany");
    expect(de.photo).toBe("expected");
    expect(de.trend).toBeTruthy(); // photo expectation is drifting
  });

  it("falls back to the safe default (US) for unknown/empty locations", () => {
    expect(resolveLocaleNorm("").code).toBe(DEFAULT_LOCALE_NORM.code);
    expect(resolveLocaleNorm("Atlantis").code).toBe(DEFAULT_LOCALE_NORM.code);
    expect(resolveLocaleNorm(undefined).code).toBe("US");
  });

  it("does not false-match substrings across words (boundary safety)", () => {
    // "Australia" contains "us" — must resolve to AU, not US (which is first in the list).
    expect(resolveLocaleNorm("Sydney, Australia").code).toBe("AU");
  });
});
