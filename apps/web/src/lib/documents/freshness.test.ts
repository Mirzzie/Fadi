import { describe, expect, it } from "vitest";

import {
  capturedContextOf,
  freshnessAsk,
  freshnessNote,
  nothingChanged,
  whatChanged,
} from "./freshness";

const rec = (over: Partial<Parameters<typeof whatChanged>[0][number]> = {}) => ({
  factId: "fact-1",
  title: "IT Support Specialist",
  organization: "Crozaint Technologies",
  detail: "Supported Windows and Linux users.",
  ...over,
});

describe("capturedContextOf", () => {
  it("reads what generation recorded", () => {
    expect(
      capturedContextOf({
        careerContextSnapshotId: "snap-1",
        careerContextFingerprint: "abc",
        contextSchemaVersion: 1,
      })
    ).toEqual({ snapshotId: "snap-1", fingerprint: "abc", schemaVersion: 1 });
  });

  it("is null for a document Fadi never generated — imported, pasted, hand-written", () => {
    expect(capturedContextOf({})).toBeNull();
    expect(capturedContextOf(null)).toBeNull();
    expect(capturedContextOf({ template: "modern" })).toBeNull();
  });
});

describe("whatChanged", () => {
  it("sees nothing when the material is the same", () => {
    const changes = whatChanged([rec()], [rec()]);
    expect(nothingChanged(changes)).toBe(true);
  });

  it("names what the person has added since", () => {
    const changes = whatChanged(
      [rec()],
      [rec(), rec({ factId: "fact-2", title: "SOC Home Lab", organization: null })]
    );
    expect(changes.added).toEqual(["SOC Home Lab"]);
    expect(changes.removed).toEqual([]);
  });

  it("sees a correction as a rewording, not as a new record", () => {
    const changes = whatChanged([rec()], [rec({ detail: "Second-line support for 400 staff." })]);
    expect(changes.reworded).toEqual(["IT Support Specialist (Crozaint Technologies)"]);
    expect(changes.added).toEqual([]);
    expect(changes.removed).toEqual([]);
  });

  it("ignores whitespace, which is not a change anybody made", () => {
    const changes = whatChanged(
      [rec()],
      [rec({ detail: "  Supported Windows and Linux\n users. " })]
    );
    expect(nothingChanged(changes)).toBe(true);
  });

  it("notices a record that is no longer selected", () => {
    expect(
      whatChanged([rec(), rec({ factId: "fact-2", title: "SOC Home Lab" })], [rec()]).removed
    ).toEqual(["SOC Home Lab (Crozaint Technologies)"]);
  });

  it("falls back to title and organisation when a record has no fact id", () => {
    const changes = whatChanged(
      [rec({ factId: null })],
      [rec({ factId: null, detail: "Reworded." })]
    );
    expect(changes.reworded).toHaveLength(1);
    expect(changes.added).toEqual([]);
  });
});

describe("what the person is told", () => {
  it("names the change rather than demanding a regeneration", () => {
    const note = freshnessNote({ added: ["SOC Home Lab"], removed: [], reworded: [] });
    expect(note).toBe(
      "Your record has changed since this was written — you've added SOC Home Lab."
    );
    expect(note).not.toMatch(/regenerat|rewrite now/i);
  });

  it("reads as one sentence when several things changed", () => {
    expect(freshnessNote({ added: ["A"], reworded: ["B"], removed: ["C"] })).toBe(
      "Your record has changed since this was written — you've added A, you updated B and C is no longer selected."
    );
  });

  it("counts the rest instead of listing everything", () => {
    expect(
      freshnessNote({ added: ["A", "B", "C", "D", "E"], removed: [], reworded: [] })
    ).toContain("A, B, C and 2 more");
  });

  it("offers an instruction the guarded rewrite can take", () => {
    expect(freshnessAsk({ added: ["SOC Home Lab"], removed: [], reworded: [] })).toBe(
      "Work in SOC Home Lab"
    );
    expect(freshnessAsk({ added: [], removed: [], reworded: ["A job"] })).toBe(
      "Use my current wording for A job"
    );
    expect(freshnessAsk({ added: [], removed: [], reworded: [] })).toBeNull();
  });
});

describe("factual corrections under an unchanged fact identity", () => {
  const record = {
    factId: "employment-1",
    title: "Support engineer",
    organization: "Former wording",
    detail: "Resolved incidents",
    period: "2024",
    metrics: "30 tickets",
    kind: "experience",
    attribution: "employment",
    tags: ["Linux"],
    marketTags: ["IT support"],
  };
  it.each([
    { organization: "Correct employer" },
    { title: "Correct title" },
    { period: "2025" },
    { metrics: "20 tickets" },
    { kind: "project" },
    { attribution: "personal" },
    { tags: ["Windows"] },
    { marketTags: ["Desktop support"] },
  ])("does not call an unchanged description fresh after %j", (correction) => {
    expect(whatChanged([record], [{ ...record, ...correction }]).reworded).toHaveLength(1);
  });
  it("does not warn for tag order alone", () => {
    expect(
      whatChanged(
        [{ ...record, tags: ["Linux", "Windows"] }],
        [{ ...record, tags: ["Windows", "Linux"] }]
      ).reworded
    ).toHaveLength(0);
  });
});
