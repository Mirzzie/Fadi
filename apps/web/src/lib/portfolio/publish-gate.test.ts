import { describe, expect, it } from "vitest";

import { toItemView } from "@careeros/portfolio";

/**
 * THE PUBLISH GATE.
 *
 * The public site is the one part of Fadi that strangers read and the owner relies on,
 * while documents, learning and interview prep are still in development. Coupling them
 * means any half-built path that writes a row can reach a recruiter.
 *
 * The SQL half is asserted in the repository (published AND confirmed). These pin the
 * contract around it: what "confirmed" means at the boundary, and that a live portfolio
 * was not emptied by shipping the gate.
 */
const item = (over: Record<string, unknown> = {}) => ({
  id: "i1",
  section: "project",
  title: "Shield-Right DevSecOps",
  subtitle: null,
  location: null,
  dateRange: null,
  description: null,
  bullets: [],
  roles: [],
  tag: null,
  url: null,
  imageUrl: null,
  gallery: [],
  isPublished: true,
  confirmedAt: null,
  ...over,
});

describe("what reaches the public site", () => {
  it("carries confirmation through to the view, so the manager can show it", () => {
    const when = new Date("2026-09-10T12:00:00Z");
    expect(toItemView(item({ confirmedAt: when }) as never).confirmedAt).toBe(
      "2026-09-10T12:00:00.000Z",
    );
  });

  it("reports an unconfirmed item as unconfirmed rather than omitting the field", () => {
    // Undefined would read as "old row, treat as fine" at every call site. Null is a
    // statement: collected automatically, nobody has looked.
    expect(toItemView(item() as never).confirmedAt).toBeNull();
  });

  it("keeps published and confirmed as separate ideas", () => {
    // isPublished is the owner's intent for a section of their site. confirmedAt is
    // whether a person has ever looked at the row. Collapsing them would mean either
    // auto-publishing unseen rows or hiding ones the owner deliberately unpublished.
    const unseenButPublished = toItemView(item({ isPublished: true }) as never);
    expect(unseenButPublished.isPublished).toBe(true);
    expect(unseenButPublished.confirmedAt).toBeNull();
  });
});
