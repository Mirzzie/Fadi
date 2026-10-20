import { describe, expect, it } from "vitest";

import { formatDay } from "./date";

describe("formatDay", () => {
  it("writes the same day whatever the machine's locale, in UTC", () => {
    expect(formatDay("2026-09-29T20:48:33.696Z")).toBe("29 Sep 2026");
    expect(formatDay(new Date(Date.UTC(2026, 0, 3, 23, 59)))).toBe("3 Jan 2026");
  });

  it("is empty for a missing or invalid date", () => {
    expect(formatDay(null)).toBe("");
    expect(formatDay("not a date")).toBe("");
  });
});
