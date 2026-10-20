import { describe, expect, it } from "vitest";

import { readRestorePayload } from "./restore-payload";

const item = (over: Record<string, unknown> = {}) => ({
  section: "project",
  title: "SOC home lab",
  image_url: "https://res.cloudinary.com/x/image/upload/v1/a.jpg",
  ...over,
});

describe("readRestorePayload", () => {
  it("accepts a real backup and keeps its media links", () => {
    const out = readRestorePayload(JSON.stringify({ version: 1, items: [item()] }));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.payload.items[0].image_url).toContain("cloudinary");
  });

  it("refuses a file that is not a Fadi backup, by name", () => {
    expect(readRestorePayload("not json")).toMatchObject({ ok: false });
    expect(readRestorePayload(JSON.stringify({ version: 2, items: [] }))).toMatchObject({ ok: false });
    expect(readRestorePayload(JSON.stringify({ version: 1 }))).toMatchObject({ ok: false });
  });

  it("C15-04: refuses the shapes that used to reach the database", () => {
    // fromExportItem(null) threw; nested objects flowed into text columns until Postgres
    // complained; neither is a thing a backup file contains.
    expect(readRestorePayload(JSON.stringify({ version: 1, items: [null] }))).toMatchObject({ ok: false });
    expect(
      readRestorePayload(JSON.stringify({ version: 1, items: [item({ title: { nested: true } })] }))
    ).toMatchObject({ ok: false });
  });

  it("caps rows, text and lists so a valid file cannot be unbounded", () => {
    const many = { version: 1, items: Array.from({ length: 501 }, () => item()) };
    expect(readRestorePayload(JSON.stringify(many))).toMatchObject({ ok: false });

    const long = { version: 1, items: [item({ description: "x".repeat(20_001) })] };
    expect(readRestorePayload(JSON.stringify(long))).toMatchObject({ ok: false });
  });

  it("only restores http(s) media links", () => {
    const sneaky = { version: 1, items: [item({ image_url: "javascript:alert(1)" })] };
    expect(readRestorePayload(JSON.stringify(sneaky))).toMatchObject({ ok: false });
  });

  it("keeps what a newer Fadi added rather than rejecting the file", () => {
    const future = { version: 1, items: [item({ someNewField: "later" })] };
    expect(readRestorePayload(JSON.stringify(future)).ok).toBe(true);
  });
});
