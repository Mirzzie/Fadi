import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseIndeedCards, parseIndeedSalary } from "./indeed-public";

/**
 * Pinned against a real ie.indeed.com response (4 cards, captured 2026-07-20).
 *
 * The point of a fixture here is drift detection. The first version of this provider
 * read a `window.mosaic.providerData` JSON blob that Indeed had already removed, so it
 * returned zero jobs from a page containing sixteen — and nothing failed, because a
 * scraper that finds nothing looks identical to a search with no results. These tests
 * turn that silent zero into a red build.
 */
const FIXTURE = readFileSync(join(__dirname, "__fixtures__/indeed-search.html"), "utf8");

describe("parseIndeedCards", () => {
  const jobs = parseIndeedCards(FIXTURE, "ie", "indeed-public");

  it("extracts every card in the fixture", () => {
    expect(jobs).toHaveLength(4);
  });

  it("reads title, company and location off a real card", () => {
    const job = jobs[0];
    expect(job.title).toBe("Junior Software Engineer");
    expect(job.company).toBe("Learnosity");
    expect(job.location).toContain("Dublin");
  });

  it("does not leak inlined CSS into the title", () => {
    // Indeed inlines <style> in every card; without stripping it the title came back
    // as the job name followed by 300 characters of emotion-generated CSS.
    for (const job of jobs) {
      expect(job.title).not.toMatch(/mosaic-provider|webkit|border-radius/);
      expect(job.title.length).toBeLessThan(120);
    }
  });

  it("builds a resolvable job URL from the job key", () => {
    expect(jobs[0].externalId).toMatch(/^in-[a-f0-9]+$/);
    expect(jobs[0].url).toMatch(/^https:\/\/ie\.indeed\.com\/viewjob\?jk=[a-f0-9]+$/);
  });

  it("normalizes employment type into the shared vocabulary", () => {
    // Indeed writes "Full-time"; filters downstream only understand "fulltime".
    const withType = jobs.filter((j) => j.tags.includes("fulltime"));
    expect(withType.length).toBeGreaterThan(0);
  });

  it("returns [] rather than throwing on a challenge or empty page", () => {
    expect(parseIndeedCards("<html><body>Verify you are human</body></html>", "ie", "x")).toEqual(
      [],
    );
    expect(parseIndeedCards("", "ie", "x")).toEqual([]);
  });
});

describe("parseIndeedSalary", () => {
  it("parses a range with currency and interval", () => {
    expect(parseIndeedSalary("€45,000 - €55,000 a year")).toEqual({
      salaryMin: 45000,
      salaryMax: 55000,
      salaryCurrency: "EUR",
      salaryInterval: "yearly",
    });
  });

  it("parses an hourly rate", () => {
    const result = parseIndeedSalary("$25.50 an hour");
    expect(result.salaryMin).toBe(25.5);
    expect(result.salaryCurrency).toBe("USD");
    expect(result.salaryInterval).toBe("hourly");
  });

  it("treats a single figure as both bounds", () => {
    const result = parseIndeedSalary("£60,000 a year");
    expect(result.salaryMin).toBe(60000);
    expect(result.salaryMax).toBe(60000);
  });

  it("leaves the interval undefined when the text omits it", () => {
    // Better unfilterable than wrongly annualized.
    expect(parseIndeedSalary("€50,000").salaryInterval).toBeUndefined();
  });
});
