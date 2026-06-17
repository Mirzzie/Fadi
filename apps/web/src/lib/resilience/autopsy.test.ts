import { describe, expect, it } from "vitest";

import {
  buildAutopsyContext,
  heuristicInsight,
  heuristicPattern,
  type AutopsyApplication,
} from "./autopsy";

const app = (title: string, company: string, rejectionStage: string | null = null): AutopsyApplication => ({
  title,
  company,
  rejectionStage,
});

describe("heuristicPattern", () => {
  it("returns null when there isn't enough data to claim a pattern honestly", () => {
    // One rejection (the current one), no history → not a pattern.
    expect(heuristicPattern("keyword", [])).toBeNull();
  });

  it("names a pattern only when a single stage accounts for >= 2 rejections", () => {
    const prior = [app("Analyst", "Acme", "keyword"), app("Analyst", "Globex", "screen")];
    // current keyword + one prior keyword = 2 at keyword
    const pattern = heuristicPattern("keyword", prior);
    expect(pattern).not.toBeNull();
    expect(pattern!.name).toMatch(/filtered before a human/i);
    expect(pattern!.evidence).toContain("2");
  });

  it("does not invent a pattern when stages are all different", () => {
    const prior = [app("Analyst", "Acme", "screen"), app("Analyst", "Globex", "final")];
    expect(heuristicPattern("interview", prior)).toBeNull();
  });

  it("identifies the interview-conversion pattern", () => {
    const prior = [app("PM", "Acme", "interview"), app("PM", "Globex", "interview")];
    const pattern = heuristicPattern("interview", prior);
    expect(pattern!.name).toMatch(/interviews but not converting/i);
  });
});

describe("heuristicInsight", () => {
  it("always returns concrete next steps and a reframe, even with no history", () => {
    const insight = heuristicInsight(app("Nurse", "St. Mary", "keyword"), {}, []);
    expect(insight.sharperNextApplication.length).toBeGreaterThan(0);
    expect(insight.reframe).not.toBe("");
    // No history → no fabricated pattern.
    expect(insight.pattern).toBeNull();
  });

  it("surfaces the pattern when the history supports one", () => {
    const prior = [app("Teacher", "School A", "keyword"), app("Teacher", "School B", "keyword")];
    const insight = heuristicInsight(app("Teacher", "School C", "keyword"), {}, prior);
    expect(insight.pattern).not.toBeNull();
    expect(insight.sharperNextApplication.join(" ")).toMatch(/keyword|referral|48 hours/i);
  });
});

describe("buildAutopsyContext", () => {
  it("includes the role, stage, reflection, and prior rejections", () => {
    const ctx = buildAutopsyContext({
      application: app("Data Analyst", "Acme", "keyword"),
      reflection: { lesson: "I applied two weeks late", nextAction: "apply faster" },
      priorRejections: [app("Data Analyst", "Globex", "screen")],
    });
    expect(ctx).toContain("Data Analyst");
    expect(ctx).toContain("Acme");
    expect(ctx).toContain("no response");
    expect(ctx).toContain("applied two weeks late");
    expect(ctx).toContain("Globex");
  });

  it("states plainly when there is no history for a pattern", () => {
    const ctx = buildAutopsyContext({
      application: app("Welder", "Forge Co", "interview"),
      reflection: {},
      priorRejections: [],
    });
    expect(ctx).toMatch(/only rejection on file|not enough history/i);
  });
});
