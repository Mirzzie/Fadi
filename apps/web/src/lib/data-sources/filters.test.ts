import { describe, expect, it } from "vitest";

import { filterJobs, jobFacets, sortJobs } from "./filters";
import type { JobPosting } from "./types";

function posting(over: Partial<JobPosting> = {}): JobPosting {
  return {
    sourceId: "test",
    externalId: Math.random().toString(36).slice(2),
    title: "Software Engineer",
    company: "Acme",
    tags: [],
    ...over,
  };
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

describe("filterJobs — text", () => {
  it("requires every term to match, so more words narrows", () => {
    const jobs = [
      posting({ title: "Senior React Engineer" }),
      posting({ title: "Senior Python Engineer" }),
    ];
    expect(filterJobs(jobs, { text: "senior" }).jobs).toHaveLength(2);
    expect(filterJobs(jobs, { text: "senior react" }).jobs).toHaveLength(1);
  });

  it("matches against skills and description, not just the title", () => {
    const jobs = [posting({ title: "Engineer", skills: ["Kubernetes"] })];
    expect(filterJobs(jobs, { text: "kubernetes" }).jobs).toHaveLength(1);
  });
});

describe("filterJobs — salary", () => {
  it("compares across intervals, not raw numbers", () => {
    // The £30/hr contract is worth £62,400/yr and must survive a £50k floor,
    // while the £25,000 salaried role must not.
    const jobs = [
      posting({ title: "Contract", salaryMin: 30, salaryInterval: "hourly" }),
      posting({ title: "Junior", salaryMin: 25000, salaryInterval: "yearly" }),
    ];
    const result = filterJobs(jobs, { salaryMin: 50000, includeUnknownSalary: false });
    expect(result.jobs.map((j) => j.title)).toEqual(["Contract"]);
  });

  it("keeps salary-less postings by default", () => {
    // Most boards omit salary; dropping these silently would hide most of the market.
    const jobs = [posting({ salaryMin: 80000, salaryInterval: "yearly" }), posting()];
    expect(filterJobs(jobs, { salaryMin: 50000 }).jobs).toHaveLength(2);
  });

  it("drops salary-less postings when asked, and counts them", () => {
    const jobs = [posting({ salaryMin: 80000, salaryInterval: "yearly" }), posting()];
    const result = filterJobs(jobs, { salaryMin: 50000, includeUnknownSalary: false });
    expect(result.jobs).toHaveLength(1);
    expect(result.excluded.salary).toBe(1);
  });

  it("treats a salary with no interval as unknown rather than assuming yearly", () => {
    // Assuming yearly on a bare "500" would let a day rate masquerade as a salary.
    const jobs = [posting({ salaryMin: 500 })];
    expect(filterJobs(jobs, { salaryMin: 50000, includeUnknownSalary: false }).jobs).toHaveLength(0);
  });
});

describe("filterJobs — remote, type, age, location", () => {
  it("filters to remote", () => {
    const jobs = [posting({ remote: true }), posting({ remote: false })];
    expect(filterJobs(jobs, { remoteOnly: true }).jobs).toHaveLength(1);
  });

  it("filters by normalized job type across board vocabularies", () => {
    const jobs = [
      posting({ title: "A", tags: ["Permanent"] }),
      posting({ title: "B", tags: ["Contractor"] }),
    ];
    // "Permanent" and "fulltime" are the same thing said by two different boards.
    const result = filterJobs(jobs, { jobTypes: ["fulltime"] });
    expect(result.jobs.map((j) => j.title)).toEqual(["A"]);
  });

  it("keeps postings that declare no job type", () => {
    const jobs = [posting({ tags: [] })];
    expect(filterJobs(jobs, { jobTypes: ["contract"] }).jobs).toHaveLength(1);
  });

  it("filters by age and keeps undated postings by default", () => {
    const jobs = [
      posting({ title: "fresh", postedAt: daysAgo(2) }),
      posting({ title: "stale", postedAt: daysAgo(60) }),
      posting({ title: "undated" }),
    ];
    const titles = filterJobs(jobs, { maxAgeDays: 7 }).jobs.map((j) => j.title);
    expect(titles).toEqual(["fresh", "undated"]);

    const strict = filterJobs(jobs, { maxAgeDays: 7, includeUndated: false }).jobs;
    expect(strict.map((j) => j.title)).toEqual(["fresh"]);
  });

  it("lets remote postings satisfy any location filter", () => {
    // Filtering to Dublin shouldn't hide a fully-remote job you could take from Dublin.
    const jobs = [
      posting({ title: "dublin", location: "Dublin" }),
      posting({ title: "remote", location: "Anywhere", remote: true }),
      posting({ title: "london", location: "London" }),
    ];
    const titles = filterJobs(jobs, { location: "dublin" }).jobs.map((j) => j.title);
    expect(titles).toEqual(["dublin", "remote"]);
  });
});

describe("filterJobs — exclusion accounting", () => {
  it("attributes each removal to one filter so counts explain an empty result", () => {
    const jobs = [
      posting({ title: "wrong text" }),
      posting({ title: "Software Engineer", remote: false }),
      posting({ title: "Software Engineer", remote: true }),
    ];
    const result = filterJobs(jobs, { text: "software", remoteOnly: true });
    expect(result.jobs).toHaveLength(1);
    expect(result.excluded.text).toBe(1);
    expect(result.excluded.remote).toBe(1);
    const removed = Object.values(result.excluded).reduce((a, b) => a + b, 0);
    expect(removed).toBe(jobs.length - result.jobs.length);
  });
});

describe("sortJobs", () => {
  it("sorts by annualized salary, not the raw figure", () => {
    const jobs = [
      posting({ title: "salaried", salaryMin: 40000, salaryInterval: "yearly" }),
      posting({ title: "contract", salaryMin: 30, salaryInterval: "hourly" }),
    ];
    expect(sortJobs(jobs, "salary").map((j) => j.title)).toEqual(["contract", "salaried"]);
  });

  it("sinks postings missing the sort field instead of treating them as zero", () => {
    const jobs = [
      posting({ title: "none" }),
      posting({ title: "paid", salaryMin: 50000, salaryInterval: "yearly" }),
    ];
    expect(sortJobs(jobs, "salary").map((j) => j.title)).toEqual(["paid", "none"]);

    const dated = [posting({ title: "none" }), posting({ title: "dated", postedAt: daysAgo(1) })];
    expect(sortJobs(dated, "date").map((j) => j.title)).toEqual(["dated", "none"]);
  });

  it("preserves the incoming order for relevance", () => {
    const jobs = [posting({ title: "a" }), posting({ title: "b" })];
    expect(sortJobs(jobs, "relevance").map((j) => j.title)).toEqual(["a", "b"]);
  });

  it("does not mutate its input", () => {
    const jobs = [
      posting({ title: "a", salaryMin: 1, salaryInterval: "yearly" }),
      posting({ title: "b", salaryMin: 2, salaryInterval: "yearly" }),
    ];
    sortJobs(jobs, "salary");
    expect(jobs.map((j) => j.title)).toEqual(["a", "b"]);
  });
});

describe("jobFacets", () => {
  it("counts remote, salaried, companies and sources", () => {
    const jobs = [
      posting({ company: "Acme", sourceId: "adzuna", remote: true }),
      posting({ company: "Acme", sourceId: "linkedin-guest" }),
      posting({ company: "Globex", sourceId: "adzuna", salaryMin: 1000, salaryInterval: "monthly" }),
    ];
    const facets = jobFacets(jobs);
    expect(facets.total).toBe(3);
    expect(facets.remote).toBe(1);
    expect(facets.withSalary).toBe(1);
    expect(facets.companies[0]).toEqual({ name: "Acme", count: 2 });
    expect(facets.sources[0]).toEqual({ id: "adzuna", count: 2 });
  });
});
