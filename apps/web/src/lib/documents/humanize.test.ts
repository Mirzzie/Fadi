import { describe, expect, it } from "vitest";

import { findAiTells, stripAiTells } from "./humanize";

describe("findAiTells", () => {
  it("flags banned clichés, case-insensitively", () => {
    expect(findAiTells("I'm passionate about design")).toEqual(["passionate"]);
    const t = findAiTells("A detail-oriented, results-driven leader");
    expect(t).toContain("results-driven");
    expect(t).toContain("detail-oriented");
  });

  it("does not false-positive on lookalike words", () => {
    expect(findAiTells("I phoned the client")).toEqual([]); // not "honed"
    expect(findAiTells("Shipped a checkout redesign that cut drop-off 18%")).toEqual([]);
  });

  it("dedupes overlapping phrases (keeps the longer)", () => {
    expect(findAiTells("a proven track record of growth")).toEqual(["proven track record"]);
  });

  it("catches the generic job-application filler", () => {
    const t = findAiTells("I'm excited about the opportunity and looking forward to discussing it.");
    expect(t).toContain("excited about the opportunity");
    expect(t).toContain("looking forward to discussing");
  });
});

describe("stripAiTells (critic loop)", () => {
  it("leaves clean text untouched and never calls the rewriter", async () => {
    let calls = 0;
    const out = await stripAiTells("I cut deploy time 35% at Northwind.", async () => {
      calls += 1;
      return "x";
    });
    expect(out).toContain("35%");
    expect(calls).toBe(0);
  });

  it("iterates to clean within the bound", async () => {
    let calls = 0;
    const out = await stripAiTells("I'm passionate and I leverage data.", async () => {
      calls += 1;
      return calls === 1 ? "I'm passionate about data." : "I care deeply about the data.";
    });
    expect(findAiTells(out)).toEqual([]);
    expect(calls).toBe(2);
  });

  it("keeps the original when a rewrite doesn't improve, and stops", async () => {
    let calls = 0;
    const dirty = "I'm passionate.";
    const out = await stripAiTells(dirty, async () => {
      calls += 1;
      return "Still passionate here.";
    });
    expect(out).toBe(dirty);
    expect(calls).toBe(1);
  });

  it("keeps the original when the rewriter throws", async () => {
    const out = await stripAiTells("I'm passionate.", async () => {
      throw new Error("provider down");
    });
    expect(out).toBe("I'm passionate.");
  });
});
