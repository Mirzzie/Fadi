import { describe, expect, it } from "vitest";

import {
  acceptFlagships,
  withoutUnsupportedFigures,
  flagshipDetail,
  flagshipsAreStale,
  FLAGSHIP_TTL_MS,
  researchQueries,
} from "./flagship-rules";

const research = [
  { url: "https://news.example/identity-breach", title: "Identity breach at retailer" },
  { url: "https://news.example/nis2", title: "NIS2 deadline" },
];

const complete = {
  title: "Contain a stolen-token takeover",
  problem: "A retailer's support staff are phished and attackers reuse their session tokens.",
  whyNow: "Token theft drove this month's retail breaches.",
  build: "Build a conditional-access and token-binding setup in a lab tenant.",
  breakIt: "Replay a stolen token and show the control blocks it.",
  demonstrates: "Identity threat detection and response.",
  scope: "3 weeks",
  buildsOn: "Your AD lab",
  sourceUrls: ["https://news.example/identity-breach"],
};

describe("acceptFlagships", () => {
  it("keeps a complete, cited proposal with its source titles", () => {
    const [one] = acceptFlagships([complete], research);
    expect(one.sources).toEqual([
      { url: "https://news.example/identity-breach", title: "Identity breach at retailer" },
    ]);
  });

  it("drops a proposal whose only citation was never in the research", () => {
    expect(
      acceptFlagships([{ ...complete, sourceUrls: ["https://invented.example/x"] }], research)
    ).toEqual([]);
  });

  it("drops a proposal with nothing to build or nothing to break", () => {
    expect(acceptFlagships([{ ...complete, breakIt: "" }], research)).toEqual([]);
  });

  it("stops at three", () => {
    expect(acceptFlagships([complete, complete, complete, complete], research)).toHaveLength(3);
  });

  it("allows uncited proposals only when there was no research to cite", () => {
    expect(acceptFlagships([{ ...complete, sourceUrls: [] }], [])).toHaveLength(1);
  });
});

describe("staleness", () => {
  it("refreshes after a week, and when never researched", () => {
    const now = Date.now();
    expect(flagshipsAreStale(null, now)).toBe(true);
    expect(flagshipsAreStale(new Date(now - FLAGSHIP_TTL_MS + 1000), now)).toBe(false);
    expect(flagshipsAreStale(new Date(now - FLAGSHIP_TTL_MS), now)).toBe(true);
  });
});

describe("researchQueries", () => {
  it("asks about problems in the field this year, not technologies", () => {
    const queries = researchQueries({
      role: "Cloud Security Engineer",
      domain: "cloud security",
      gaps: ["IAM"],
      year: 2026,
    });
    expect(queries[0]).toBe("cloud security biggest challenges organisations face 2026");
    expect(queries).toContain("IAM problems companies 2026");
  });
});

describe("flagshipDetail", () => {
  it("puts the problem first, as its own paragraph", () => {
    const [one] = acceptFlagships([complete], research);
    expect(flagshipDetail(one).split("\n\n")[0]).toBe(complete.problem);
  });
});

describe("withoutUnsupportedFigures", () => {
  const corpus = "Report: 44% of breaches involved stolen credentials in 2026.";

  it("drops a sentence whose figure is not in the research, keeps the rest", () => {
    expect(
      withoutUnsupportedFigures(
        "Retailers are losing customer trust. They lose €10,000 per month to attacks.",
        corpus
      )
    ).toBe("Retailers are losing customer trust.");
  });

  it("keeps a figure the research does state, and years", () => {
    expect(withoutUnsupportedFigures("In 2026, 44% of breaches used stolen logins.", corpus)).toBe(
      "In 2026, 44% of breaches used stolen logins."
    );
  });
});

describe("titles", () => {
  it("strips numbering a model adds", () => {
    const [one] = acceptFlagships(
      [{ ...complete, title: "Flagship Project 2: Contain a takeover" }],
      research
    );
    expect(one.title).toBe("Contain a takeover");
  });
});

describe("flagshipDetail for the planner", () => {
  it("carries why now and what it proves after the work, never before the problem", () => {
    const [one] = acceptFlagships([complete], research);
    const parts = flagshipDetail(one).split("\n\n");
    expect(parts).toHaveLength(3);
    expect(parts[1]).toContain("Then: Replay a stolen token");
    expect(parts[2]).toBe(
      "Why now: Token theft drove this month's retail breaches.\nIt should demonstrate: Identity threat detection and response."
    );
  });
});
