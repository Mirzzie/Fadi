import { describe, expect, it } from "vitest";

import type { EvidenceItem, PortfolioItem } from "@careeros/database";
import { fromExportItem, seedItemsFromEvidence, toExportItem, toItemView } from "@careeros/portfolio";

/**
 * These transforms have zero tests and sit on the two most destructive portfolio paths:
 * the export/import round-trip (import "replace" mode wipes and re-inserts — see
 * portfolio.repository.ts replaceItems) and the evidence→portfolio projection (the flow
 * that only started producing data once the A1 schema bug was fixed). A silent field
 * drop here corrupts or loses a user's public site with no error. Pure logic, so the
 * cost of pinning it is nil.
 */

function portfolioItem(over: Partial<PortfolioItem> = {}): PortfolioItem {
  return {
    id: "pi-1",
    userId: "u-1",
    siteId: "s-1",
    evidenceItemId: null,
    section: "project",
    title: "Home lab SIEM",
    subtitle: "Personal",
    location: "Dublin",
    dateRange: "2025",
    description: "Built a detection lab.",
    bullets: ["Wazuh", "Suricata"],
    roles: ["builder"],
    tag: "security",
    url: "https://example.com",
    imageUrl: "https://img/1.png",
    gallery: ["https://img/2.png"],
    sortOrder: 20,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as PortfolioItem;
}

function evidenceItem(over: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: "e-1",
    userId: "u-1",
    kind: "project",
    title: "Vulnerability lab",
    organization: "Home",
    period: "2025",
    detail: "Ran a full incident-handling simulation.",
    metrics: "Cut MTTR to 4 min",
    tags: ["wazuh", "siem"],
    marketTags: ["incident response"],
    origin: "ai",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as EvidenceItem;
}

describe("export/import round-trip", () => {
  it("preserves every field through toExportItem → fromExportItem", () => {
    // The invariant that keeps import non-destructive: what you export must import back
    // identically. A dropped field here silently loses data on a replace-mode import.
    const original = portfolioItem();
    const restored = fromExportItem(toExportItem(original));

    expect(restored).toMatchObject({
      section: original.section,
      title: original.title,
      subtitle: original.subtitle,
      location: original.location,
      dateRange: original.dateRange,
      roles: original.roles,
      description: original.description,
      tag: original.tag,
      url: original.url,
      imageUrl: original.imageUrl,
      gallery: original.gallery,
      bullets: original.bullets,
      sortOrder: original.sortOrder,
      isPublished: original.isPublished,
    });
  });

  it("maps snake_case interchange keys to camelCase DB fields", () => {
    // The two shapes disagree on casing on purpose (interchange matches the standalone
    // portfolio export). A rename on one side without the other silently nulls a field.
    const exported = toExportItem(portfolioItem());
    expect(exported.date_range).toBe("2025");
    expect(exported.image_url).toBe("https://img/1.png");
    expect(exported.is_published).toBe(true);
    expect(exported.sort_order).toBe(20);
  });
});

describe("fromExportItem — defensive parsing of untrusted JSON", () => {
  it("fills safe defaults for a nearly-empty object", () => {
    const r = fromExportItem({});
    expect(r).toMatchObject({
      section: "custom",
      title: "",
      subtitle: null,
      roles: [],
      gallery: [],
      bullets: [],
      sortOrder: 0,
    });
  });

  it("defaults a MISSING is_published to published=true — the import footgun", () => {
    // Deliberately pinned because it is surprising and user-visible: an imported item
    // that never mentions is_published becomes PUBLIC. If that default is ever changed,
    // this test should change with it as a conscious decision, not silently.
    expect(fromExportItem({ title: "x" }).isPublished).toBe(true);
    // Only an explicit false unpublishes.
    expect(fromExportItem({ title: "x", is_published: false }).isPublished).toBe(false);
    expect(fromExportItem({ title: "x", is_published: true }).isPublished).toBe(true);
  });

  it("coerces a non-string title rather than throwing", () => {
    // Untrusted JSON: a number title must not crash the import.
    expect(fromExportItem({ title: 42 as unknown as string }).title).toBe("42");
  });

  it("rejects non-array roles/gallery/bullets instead of passing them through", () => {
    const r = fromExportItem({
      roles: "builder" as unknown as string[],
      gallery: null as unknown as string[],
      bullets: undefined,
    });
    expect(r.roles).toEqual([]);
    expect(r.gallery).toEqual([]);
    expect(r.bullets).toEqual([]);
  });

  it("ignores a non-numeric sort_order", () => {
    expect(fromExportItem({ sort_order: "3" as unknown as number }).sortOrder).toBe(0);
  });
});

describe("seedItemsFromEvidence — the evidence→portfolio projection", () => {
  it("maps evidence kinds to portfolio sections, folding achievement into project", () => {
    const kinds: Array<[EvidenceItem["kind"], string]> = [
      ["experience", "experience"],
      ["project", "project"],
      ["achievement", "project"], // achievements surface as projects
      ["skill", "skill"],
      ["education", "education"],
    ];
    for (const [kind, section] of kinds) {
      const [seeded] = seedItemsFromEvidence([evidenceItem({ kind })]);
      expect(seeded.section).toBe(section);
    }
  });

  it("routes an unknown kind to 'custom' rather than dropping it", () => {
    const [seeded] = seedItemsFromEvidence([
      evidenceItem({ kind: "wildcard" as EvidenceItem["kind"] }),
    ]);
    expect(seeded.section).toBe("custom");
  });

  it("derives narrative fields from real evidence, never inventing", () => {
    const [seeded] = seedItemsFromEvidence([evidenceItem()]);
    expect(seeded).toMatchObject({
      evidenceItemId: "e-1",
      title: "Vulnerability lab",
      subtitle: "Home",
      dateRange: "2025",
      description: "Ran a full incident-handling simulation.",
      bullets: ["Cut MTTR to 4 min"], // metrics becomes the single bullet
      tag: "wazuh", // first tag
    });
  });

  it("turns an empty detail into null and absent metrics into no bullets", () => {
    const [seeded] = seedItemsFromEvidence([
      evidenceItem({ detail: "", metrics: null, tags: [] }),
    ]);
    expect(seeded.description).toBeNull();
    expect(seeded.bullets).toEqual([]);
    expect(seeded.tag).toBeNull();
  });

  it("assigns stable increasing sort order (10, 20, 30…)", () => {
    const seeded = seedItemsFromEvidence([
      evidenceItem({ id: "a" }),
      evidenceItem({ id: "b" }),
      evidenceItem({ id: "c" }),
    ]);
    expect(seeded.map((s) => s.sortOrder)).toEqual([10, 20, 30]);
  });

  it("survives an empty evidence pool", () => {
    expect(seedItemsFromEvidence([])).toEqual([]);
  });
});

describe("toItemView — null-safe array coalescing", () => {
  it("never returns null arrays, even when the DB columns are null", () => {
    // Simulate DB rows where the array columns are genuinely null (nullable jsonb).
    const view = toItemView(
      portfolioItem({ bullets: null, roles: null, gallery: null } as unknown as Partial<PortfolioItem>),
    );
    expect(view.bullets).toEqual([]);
    expect(view.roles).toEqual([]);
    expect(view.gallery).toEqual([]);
  });
});
