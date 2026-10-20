import { describe, expect, it } from "vitest";

import { driftNote, nothingDrifted, portfolioFreshness } from "./freshness";

const day = (n: number) => new Date(`2026-09-${String(n).padStart(2, "0")}T12:00:00Z`);

const item = (over: Partial<Parameters<typeof portfolioFreshness>[0][number]> = {}) => ({
  id: "item-1",
  title: "SOC home lab",
  evidenceItemId: "ev-1",
  isPublished: true,
  updatedAt: day(10),
  ...over,
});

const record = (over: Partial<Parameters<typeof portfolioFreshness>[1][number]> = {}) => ({
  id: "ev-1",
  title: "SOC home lab",
  updatedAt: day(10),
  ...over,
});

describe("portfolioFreshness", () => {
  it("says nothing when the site matches the record", () => {
    expect(nothingDrifted(portfolioFreshness([item()], [record()]))).toBe(true);
  });

  it("flags a live item whose evidence is no longer accepted", () => {
    const drift = portfolioFreshness([item()], []);
    expect(drift.withdrawn).toEqual([{ id: "item-1", title: "SOC home lab" }]);
  });

  it("flags an item the person corrected after publishing it", () => {
    const drift = portfolioFreshness([item()], [record({ updatedAt: day(15) })]);
    expect(drift.reworded).toEqual([{ id: "item-1", title: "SOC home lab" }]);
    expect(drift.withdrawn).toEqual([]);
  });

  it("does not flag an item edited after the record changed", () => {
    const drift = portfolioFreshness([item({ updatedAt: day(20) })], [record({ updatedAt: day(15) })]);
    expect(nothingDrifted(drift)).toBe(true);
  });

  it("treats the same save as the same save, not an edit", () => {
    const drift = portfolioFreshness(
      [item({ updatedAt: new Date("2026-09-10T12:00:00.000Z") })],
      [record({ updatedAt: new Date("2026-09-10T12:00:00.400Z") })]
    );
    expect(nothingDrifted(drift)).toBe(true);
  });

  it("flags a live item whose evidence was DELETED, which severs the link", () => {
    // The foreign key nulls evidence_item_id on delete, so without the marker this item looks
    // exactly like one the person wrote by hand.
    const drift = portfolioFreshness(
      [item({ evidenceItemId: null, unbackedSince: day(12) })],
      [record()]
    );
    expect(drift.withdrawn).toEqual([{ id: "item-1", title: "SOC home lab" }]);
  });

  it("leaves unpublished drafts and portfolio-only items alone", () => {
    expect(nothingDrifted(portfolioFreshness([item({ isPublished: false })], []))).toBe(true);
    expect(
      nothingDrifted(portfolioFreshness([item({ isPublished: false, unbackedSince: day(12) })], []))
    ).toBe(true);
    expect(nothingDrifted(portfolioFreshness([item({ evidenceItemId: null })], []))).toBe(true);
  });

  it("says what is wrong in terms of the public page", () => {
    const note = driftNote(
      portfolioFreshness(
        [item(), item({ id: "item-2", title: "Ticket triage", evidenceItemId: "ev-2" })],
        [record({ id: "ev-2", title: "Ticket triage", updatedAt: day(18) })]
      )
    );
    expect(note).toBe(
      "Your site is showing older wording — SOC home lab is live but no longer in your record, and you've since corrected Ticket triage."
    );
  });

  it("counts the rest rather than listing everything", () => {
    const many = ["a", "b", "c", "d"].map((id) =>
      item({ id, title: id.toUpperCase(), evidenceItemId: `ev-${id}` })
    );
    expect(driftNote(portfolioFreshness(many, []))).toContain("A, B, C and 1 more");
  });
});
