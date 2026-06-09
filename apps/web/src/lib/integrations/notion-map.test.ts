import { describe, expect, it } from "vitest";

import { buildNotionProperties } from "./notion-map";

describe("buildNotionProperties", () => {
  it("maps a full application to Notion page properties", () => {
    const props = buildNotionProperties({
      company: "Acme",
      title: "Product Designer",
      url: "https://acme.jobs/1",
      status: "applied",
      appliedAt: new Date("2026-06-01T12:00:00Z"),
    }) as Record<string, { title?: unknown[]; rich_text?: unknown[]; select?: { name: string }; url?: string; date?: { start: string } }>;

    expect(props.Name.title).toEqual([{ text: { content: "Product Designer" } }]);
    expect(props.Company.rich_text).toEqual([{ text: { content: "Acme" } }]);
    expect(props.Status.select).toEqual({ name: "applied" });
    expect(props.URL.url).toBe("https://acme.jobs/1");
    expect(props.Applied.date).toEqual({ start: "2026-06-01" }); // YYYY-MM-DD
  });

  it("omits optional fields that are absent, and never crashes on a bare row", () => {
    const props = buildNotionProperties({ company: "X", title: "Y" });
    expect(props.Name).toBeDefined();
    expect(props.Company).toBeDefined();
    expect(props.Status).toBeUndefined();
    expect(props.URL).toBeUndefined();
    expect(props.Applied).toBeUndefined();
  });

  it("falls back to a placeholder title", () => {
    const props = buildNotionProperties({ company: "X", title: "" }) as Record<string, { title: { text: { content: string } }[] }>;
    expect(props.Name.title[0].text.content).toBe("Untitled role");
  });
});
