import { describe, expect, it } from "vitest";

import {
  mergeResearch,
  setAside,
  adoptIdea,
  type Flagship,
  type FlagshipIdea,
} from "./flagship-rules";

const f = (title: string): Flagship => ({
  title,
  problem: "p",
  whyNow: "w",
  build: "b",
  breakIt: "x",
  demonstrates: "d",
  scope: "s",
  buildsOn: "",
  sources: [],
});
const NOW = "2026-10-15T10:00:00.000Z";
const titles = (list: Array<Flagship | FlagshipIdea>) =>
  list.map((x) => ("flagship" in x ? x.flagship.title : x.title));

describe("flagships stay until the person changes them", () => {
  it("fills them the first time, then research only adds new ideas beside them", () => {
    const first = mergeResearch([], [], [f("SIEM"), f("Hardening"), f("PDF sanitiser")], NOW);
    expect(titles(first.flagships)).toEqual(["SIEM", "Hardening", "PDF sanitiser"]);

    const next = mergeResearch(
      first.flagships,
      first.ideas,
      [f("SIEM"), f("Zero trust"), f("Backup drill")],
      NOW
    );
    expect(titles(next.flagships)).toEqual(["SIEM", "Hardening", "PDF sanitiser"]);
    expect(next.ideas.map((i) => [i.flagship.title, i.state])).toEqual([
      ["Zero trust", "new"],
      ["Backup drill", "new"],
    ]);

    // A week later the unused new ideas are earlier ideas — still there.
    const later = mergeResearch(next.flagships, next.ideas, [f("Cloud IAM")], NOW);
    expect(later.ideas.map((i) => [i.flagship.title, i.state])).toEqual([
      ["Cloud IAM", "new"],
      ["Zero trust", "earlier"],
      ["Backup drill", "earlier"],
    ]);
  });

  it("swaps an idea in, and the one it replaces becomes an earlier idea — never deleted", () => {
    const ideas: FlagshipIdea[] = [{ flagship: f("Zero trust"), state: "new", at: NOW }];
    const swapped = adoptIdea(
      [f("SIEM"), f("Hardening"), f("PDF")],
      ideas,
      "Zero trust",
      "PDF",
      NOW
    )!;
    expect(titles(swapped.flagships)).toEqual(["SIEM", "Hardening", "Zero trust"]);
    expect(swapped.ideas.map((i) => [i.flagship.title, i.state])).toEqual([["PDF", "earlier"]]);
  });

  it("adds without replacing when there is room, and refuses a fourth", () => {
    const ideas: FlagshipIdea[] = [{ flagship: f("Zero trust"), state: "new", at: NOW }];
    expect(titles(adoptIdea([f("SIEM")], ideas, "Zero trust", null, NOW)!.flagships)).toEqual([
      "SIEM",
      "Zero trust",
    ]);
    expect(adoptIdea([f("A"), f("B"), f("C")], ideas, "Zero trust", null, NOW)).toBeNull();
  });

  it("sets a flagship aside as an earlier idea, which can be brought back", () => {
    const aside = setAside([f("SIEM"), f("Hardening")], [], "SIEM", NOW)!;
    expect(titles(aside.flagships)).toEqual(["Hardening"]);
    const back = adoptIdea(aside.flagships, aside.ideas, "SIEM", null, NOW)!;
    expect(titles(back.flagships)).toEqual(["Hardening", "SIEM"]);
    expect(back.ideas).toEqual([]);
  });
});
