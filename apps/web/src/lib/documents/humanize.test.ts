import { describe, expect, it } from "vitest";

import {
  analyzeHumanity,
  burstiness,
  findAiTells,
  findTemplateTells,
  stripAiTells,
} from "./humanize";

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

describe("findAiTells — 2026 AI-accent vocabulary", () => {
  it("catches the modern slop words", () => {
    const t = findAiTells("Let me delve into the multifaceted tapestry of today's job landscape.");
    expect(t).toContain("delve");
    expect(t).toContain("multifaceted");
    expect(t).toContain("tapestry");
  });

  it("catches stock transitions", () => {
    expect(findAiTells("Furthermore, it is worth noting that I am qualified.")).toEqual(
      expect.arrayContaining(["furthermore", "it is worth noting"]),
    );
  });

  it("leaves legitimate career verbs alone (false-positive guard)", () => {
    expect(
      findAiTells("Streamlined onboarding 30% and facilitated weekly client workshops."),
    ).toEqual([]);
  });
});

describe("findTemplateTells", () => {
  it("flags the '<verb> X to <improve> Y' template shape", () => {
    const tells = findTemplateTells("Managed projects to increase efficiency.\n");
    expect(tells).toHaveLength(1);
    expect(tells[0]).toContain("template bullet shape");
  });

  it("flags 'played a key role' and 'not only…but also'", () => {
    expect(findTemplateTells("I played a pivotal role in the launch.")).toHaveLength(1);
    expect(
      findTemplateTells("I not only shipped the feature but also wrote the docs."),
    ).toHaveLength(1);
  });

  it("passes specific, concrete writing", () => {
    expect(
      findTemplateTells("Rebuilt the checkout flow in Q3; drop-off fell from 31% to 13%."),
    ).toEqual([]);
  });
});

describe("burstiness", () => {
  it("returns null when there are too few sentences to judge", () => {
    expect(burstiness("One sentence. Two sentences here.")).toBeNull();
  });

  it("scores uniform machine-rhythm prose low and varied prose higher", () => {
    const uniform =
      "I built the data pipeline for them. I shipped the reporting layer too. I managed the client meetings well. I improved the testing process there.";
    const varied =
      "I built the data pipeline. Then, over a difficult quarter where the client changed scope twice, I rebuilt the reporting layer from scratch. It worked. Adoption tripled within six weeks of the relaunch.";
    expect(burstiness(uniform)!).toBeLessThan(burstiness(varied)!);
  });
});

describe("analyzeHumanity", () => {
  it("combines tells, templates and rhythm into one issue count", () => {
    const a = analyzeHumanity("I leverage synergy. I played a key role in delivery.");
    expect(a.tells).toEqual(expect.arrayContaining(["leverage", "synergy"]));
    expect(a.templateTells).toHaveLength(1);
    expect(a.issueCount).toBeGreaterThanOrEqual(3);
  });

  it("gives clean, specific writing a zero issue count", () => {
    const a = analyzeHumanity(
      "Rebuilt the rota system for a 40-bed care home where shift-fill had been taking three days and morale was paying for it. It worked. Fill time fell to 4 hours. The trick was boring: one shared calendar, ruthlessly maintained, and turnover dropped the very next quarter.",
    );
    expect(a.issueCount).toBe(0);
    expect(a.tellDensityPer100).toBe(0);
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
