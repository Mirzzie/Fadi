import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { DESTINATIONS, NAV_TARGETS, areaFor, destinationFor } from "./navigation";

const APP = fileURLToPath(new URL("../../app", import.meta.url));

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

  /**
   * The mapping tests below prove a href is filed under the right destination. They cannot
   * prove it goes anywhere: "Directions" pointed at /dashboard/tracks, which has actions and
   * no page, and shipped as a labelled 404.
   */
  it("points every label at a page that exists", () => {
    for (const target of NAV_TARGETS) {
      const route = target.href.replace(/^\//, "").split("?")[0];
      expect(existsSync(`${APP}/${route}/page.tsx`), `${target.label} → ${target.href}`).toBe(
        true
      );
    }
  });

  it("offers every area to search, plus the account pages", () => {
    const hrefs = NAV_TARGETS.map((target) => target.href);
    expect(hrefs).toContain("/dashboard/network");
    expect(hrefs).toContain("/dashboard/portfolio");
    expect(hrefs).toContain("/dashboard/settings");
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
