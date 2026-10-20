import { describe, expect, it } from "vitest";

import { isPostingUrl, postingLinksFrom } from "./board-links";

describe("isPostingUrl", () => {
  it("recognises one posting on the big ATS platforms", () => {
    const postings = [
      "https://job-boards.greenhouse.io/kaseya/jobs/6161206004",
      "https://jobs.ashbyhq.com/notion/e0971bdd-0e09-4299-b161-74a382d54741",
      "https://jobs.lever.co/acme/3f2a1b9c-4d5e-11ee-be56-0242ac120002",
      "https://apply.workable.com/fenergocareers/j/2D5958752E",
      "https://jobs.smartrecruiters.com/Version1/744000085395015-it-support-engineer",
      "https://acme.bamboohr.com/careers/142",
    ];
    for (const url of postings) expect(isPostingUrl(url), url).toBe(true);
  });

  it("does not mistake a board, a filter or a marketing page for a posting", () => {
    const boards = [
      "https://job-boards.greenhouse.io/tines",
      "https://apply.workable.com/tekenable/",
      "https://careers.smartrecruiters.com/version1",
      "https://jobs.ashbyhq.com/notion",
      "https://www.acme.com/about",
      "mailto:jobs@acme.com",
    ];
    for (const url of boards) expect(isPostingUrl(url), url).toBe(false);
  });
});

describe("postingLinksFrom", () => {
  const board = "https://job-boards.greenhouse.io/tines";

  it("takes the board's own postings, absolute and deduped", () => {
    expect(
      postingLinksFrom(board, [
        "/tines/jobs/4041234",
        "https://job-boards.greenhouse.io/tines/jobs/4041234?gh_src=abc",
        "https://job-boards.greenhouse.io/tines/jobs/4045678",
        "https://job-boards.greenhouse.io/tines",
      ])
    ).toEqual([
      "https://job-boards.greenhouse.io/tines/jobs/4041234",
      "https://job-boards.greenhouse.io/tines/jobs/4045678",
    ]);
  });

  it("follows a board across its own subdomains but never off the site", () => {
    expect(
      postingLinksFrom("https://careers.smartrecruiters.com/version1", [
        "https://jobs.smartrecruiters.com/Version1/744000085395015-it-support",
        "https://www.linkedin.com/jobs/view/123456789",
        "https://other-company.com/jobs/998877",
      ])
    ).toEqual(["https://jobs.smartrecruiters.com/Version1/744000085395015-it-support"]);
  });

  it("stops at the cap — a crawl of one board, not of a careers site", () => {
    const many = Array.from({ length: 40 }, (_, i) => `${board}/jobs/40${i}0000`);
    expect(postingLinksFrom(board, many)).toHaveLength(8);
    expect(postingLinksFrom(board, many, 3)).toHaveLength(3);
  });

  it("returns nothing for junk hrefs or an unreadable page url", () => {
    expect(postingLinksFrom(board, ["javascript:void(0)", "#main", ""])).toEqual([]);
    expect(postingLinksFrom("not a url", [`${board}/jobs/4041234`])).toEqual([]);
  });
});
