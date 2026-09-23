import { describe, expect, it } from "vitest";

import { DESTINATIONS, NAV_TARGETS, areaFor, destinationFor } from "./navigation";

describe("four destinations", () => {
  it("puts every route under exactly one destination", () => {
    const seen = new Map<string, string>();
    for (const destination of DESTINATIONS) {
      for (const area of destination.areas) {
        expect(seen.has(area.href)).toBe(false);
        seen.set(area.href, destination.label);
      }
    }
  });

  it("lights the destination a page belongs to, not the one with the shortest route", () => {
    expect(destinationFor("/dashboard")?.label).toBe("Today");
    expect(destinationFor("/dashboard/overview")?.label).toBe("Today");
    expect(destinationFor("/dashboard/documents")?.label).toBe("My career");
    expect(destinationFor("/dashboard/documents/abc-123")?.label).toBe("My career");
    expect(destinationFor("/dashboard/applications/1/workspace")?.label).toBe("Opportunities");
    expect(destinationFor("/dashboard/interview")?.label).toBe("Practice");
  });

  it("claims nothing for the pages reached from the account menu", () => {
    expect(destinationFor("/dashboard/settings")).toBeNull();
    expect(destinationFor("/dashboard/profile")).toBeNull();
    expect(destinationFor("/dashboard/niche-finder")).toBeNull();
    expect(destinationFor("/onboarding")).toBeNull();
  });

  it("names the area you are in, so the sub-navigation can mark it", () => {
    expect(areaFor("/dashboard/portfolio/manage")?.label).toBe("Portfolio");
    expect(areaFor("/dashboard")?.label).toBe("Today");
    expect(areaFor("/dashboard/settings")).toBeNull();
  });

  it("offers every area to search, plus the account pages", () => {
    const hrefs = NAV_TARGETS.map((target) => target.href);
    expect(hrefs).toContain("/dashboard/network");
    expect(hrefs).toContain("/dashboard/settings");
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
