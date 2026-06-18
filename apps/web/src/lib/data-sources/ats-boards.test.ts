import { describe, expect, it } from "vitest";

import {
  atsUrl,
  companySlugs,
  filterByRole,
  mapAshby,
  mapGreenhouse,
  mapLever,
} from "./ats-boards";

describe("companySlugs", () => {
  it("derives compact and hyphenated slugs and strips legal suffixes", () => {
    expect(companySlugs("Stripe, Inc.")).toEqual(["stripe"]);
    expect(companySlugs("Acme Health Co")).toEqual(["acmehealth", "acme-health"]);
  });

  it("handles ampersands and punctuation", () => {
    expect(companySlugs("Ben & Jerry's")).toEqual(["benandjerrys", "ben-and-jerrys"]);
  });

  it("returns nothing for an empty name", () => {
    expect(companySlugs("   ")).toEqual([]);
  });
});

describe("atsUrl", () => {
  it("builds the correct keyless endpoints", () => {
    expect(atsUrl.greenhouse("stripe")).toBe(
      "https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true",
    );
    expect(atsUrl.lever("netflix")).toBe("https://api.lever.co/v0/postings/netflix?mode=json");
    expect(atsUrl.ashby("ramp")).toBe(
      "https://api.ashbyhq.com/posting-api/job-board/ramp?includeCompensation=true",
    );
  });
});

describe("response mappers", () => {
  it("maps Greenhouse jobs and strips HTML from content", () => {
    const out = mapGreenhouse(
      {
        jobs: [
          {
            id: 1,
            title: "Staff Nurse",
            absolute_url: "https://example.com/1",
            location: { name: "Dublin" },
            first_published: "2026-06-01T00:00:00Z",
            content: "<p>Care for &amp; support patients</p>",
          },
          { id: 2, title: "No URL" }, // dropped — no absolute_url
        ],
      },
      "Acme Health",
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      sourceId: "ats:greenhouse",
      title: "Staff Nurse",
      company: "Acme Health",
      location: "Dublin",
      url: "https://example.com/1",
      description: "Care for & support patients",
    });
  });

  it("maps Lever postings with categories and epoch dates", () => {
    const out = mapLever(
      [
        {
          id: "abc",
          text: "Electrician",
          hostedUrl: "https://jobs.lever.co/x/abc",
          categories: { location: "Berlin", team: "Facilities", commitment: "Full-time" },
          createdAt: 0,
          descriptionPlain: "Wire things.",
        },
      ],
      "X Corp",
    );
    expect(out[0]).toMatchObject({
      sourceId: "ats:lever",
      title: "Electrician",
      location: "Berlin",
      tags: ["Facilities", "Full-time"],
      postedAt: "1970-01-01T00:00:00.000Z",
    });
  });

  it("maps Ashby jobs with compensation text", () => {
    const out = mapAshby(
      {
        jobs: [
          {
            id: "j1",
            title: "Financial Analyst",
            jobUrl: "https://jobs.ashbyhq.com/x/j1",
            location: "Remote",
            isRemote: true,
            publishedAt: "2026-06-10T00:00:00Z",
            compensation: { minValue: 70000, maxValue: 90000, currency: "USD", interval: "1 YEAR" },
          },
        ],
      },
      "Finance Co",
    );
    expect(out[0]).toMatchObject({
      sourceId: "ats:ashby",
      title: "Financial Analyst",
      remote: true,
      salaryText: "USD 70000–90000/YEAR",
    });
  });
});

describe("filterByRole", () => {
  const jobs = [
    { sourceId: "ats:greenhouse", externalId: "1", title: "Registered Nurse", company: "A", tags: [] },
    { sourceId: "ats:greenhouse", externalId: "2", title: "Software Engineer", company: "A", tags: [] },
  ];

  it("keeps only roles whose title matches a keyword", () => {
    expect(filterByRole(jobs, ["nurse"]).map((j) => j.title)).toEqual(["Registered Nurse"]);
  });

  it("returns everything when no keywords are given", () => {
    expect(filterByRole(jobs, [])).toHaveLength(2);
  });
});
