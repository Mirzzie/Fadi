import { describe, expect, it } from "vitest";

import { keepCrawlable, parseBrave, parseGoogle, parseSearxng, type SearchHit } from "./web-search";

describe("search backend parsers", () => {
  it("parseSearxng maps results", () => {
    expect(
      parseSearxng({ results: [{ url: "https://careers.acme.com/1", title: "IT Support", content: "Dublin" }] }),
    ).toEqual([{ url: "https://careers.acme.com/1", title: "IT Support", snippet: "Dublin" }]);
  });

  it("parseGoogle maps items", () => {
    expect(
      parseGoogle({ items: [{ link: "https://careers.acme.com/1", title: "IT Support", snippet: "Dublin" }] }),
    ).toEqual([{ url: "https://careers.acme.com/1", title: "IT Support", snippet: "Dublin" }]);
  });

  it("parseBrave maps web.results", () => {
    expect(
      parseBrave({ web: { results: [{ url: "https://careers.acme.com/1", title: "IT Support", description: "Dublin" }] } }),
    ).toEqual([{ url: "https://careers.acme.com/1", title: "IT Support", snippet: "Dublin" }]);
  });

  it("all return [] for an empty/wrong shape", () => {
    expect(parseSearxng({})).toEqual([]);
    expect(parseGoogle(null)).toEqual([]);
    expect(parseBrave({})).toEqual([]);
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
