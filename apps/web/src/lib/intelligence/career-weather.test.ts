import { describe, expect, it } from "vitest";

import { macroToCard, shiftToCard, signalToCard } from "./career-weather";
import type { ShiftRelevance } from "./world-shifts";

describe("career-weather card builders (every card has a controllable move)", () => {
  it("maps a world shift, preserving the positioning move", () => {
    const rel: ShiftRelevance = {
      relation: "pressure",
      shift: {
        id: "x",
        name: "AI task automation",
        whatsHappening: "Routine tasks are being automated.",
        careerImplication: "Routine roles compress.",
        pressuredDomains: ["data entry"],
        resilientDomains: [],
        positioningMove: "Move toward judgment-heavy work.",
        sources: "WEF 2026",
        reviewed: "2026-06-01",
      },
    };
    const card = shiftToCard(rel);
    expect(card).toMatchObject({
      kind: "shift",
      tag: "pressure",
      title: "AI task automation",
      meaning: "Routine roles compress.",
      move: "Move toward judgment-heavy work.",
    });
  });

  it("maps a macro reading into a titled card with its move", () => {
    const card = macroToCard({
      id: "inflation",
      label: "Inflation (CPI, YoY)",
      value: "6.2%",
      reading: "Hot.",
      move: "Re-benchmark your pay.",
    });
    expect(card.tag).toBe("macro");
    expect(card.title).toBe("Inflation (CPI, YoY): 6.2%");
    expect(card.move).toBe("Re-benchmark your pay.");
  });

  it("maps a news signal with an honest non-overreaction move", () => {
    const card = signalToCard({
      sourceId: "gdelt",
      kind: "news",
      title: "Sector layoffs reported",
      summary: "A wave of cuts.",
      skills: [],
      regions: [],
      sectors: [],
      relevance: 80,
      reasons: ["touches your sector"],
      url: "https://example.com",
    });
    expect(card).toMatchObject({ kind: "news", tag: "news", url: "https://example.com" });
    expect(card.move).toMatch(/not worth reacting to on its own/i);
  });
});
