import { describe, expect, it } from "vitest";

import { keepCrawlable, parseBrave, type SearchHit } from "./web-search";

describe("parseBrave", () => {
  it("maps Brave web results to hits", () => {
    const hits = parseBrave({
      web: {
        results: [
          { url: "https://careers.acme.com/job/1", title: "IT Support", description: "Dublin role" },
          { url: "not-a-url", title: "junk" },
        ],
      },
    });
    expect(hits).toEqual([
      { url: "https://careers.acme.com/job/1", title: "IT Support", snippet: "Dublin role" },
    ]);
  });

  it("returns [] for a shape without results", () => {
    expect(parseBrave({})).toEqual([]);
    expect(parseBrave(null)).toEqual([]);
  });
});

describe("keepCrawlable", () => {
  const hits: SearchHit[] = [
    { url: "https://careers.acme.com/jobs/1" },
    { url: "https://www.linkedin.com/jobs/view/1" }, // walled → drop
    { url: "https://ie.indeed.com/viewjob?jk=1" }, // walled → drop
    { url: "https://boards.greenhouse.io/stripe/jobs/2" },
    { url: "https://careers.acme.com/jobs/1" }, // dupe → drop
    { url: "https://reddit.com/r/jobs" }, // social → drop
  ];

  it("drops walled/social hosts and de-dupes", () => {
    const kept = keepCrawlable(hits).map((h) => h.url);
    expect(kept).toEqual([
      "https://careers.acme.com/jobs/1",
      "https://boards.greenhouse.io/stripe/jobs/2",
    ]);
  });
});
