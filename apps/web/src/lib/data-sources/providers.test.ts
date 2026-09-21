import { describe, expect, it, vi } from "vitest";

import { ApifyLinkedInSource, normalizeApifyJobs } from "./providers/apify-linkedin";
import { BlsSource, snapshotToSignal } from "./providers/bls";
import { JSearchSource, normalizeJSearch } from "./providers/jsearch";
import { LightcastSkillsSource, skillsToSignal } from "./providers/lightcast";

describe("JSearch provider", () => {
  it("normalizes a JSearch payload to JobPostings", () => {
    const jobs = normalizeJSearch({
      data: [
        {
          job_id: "abc",
          employer_name: "Acme Health",
          job_title: "Registered Nurse",
          job_city: "Dublin",
          job_country: "IE",
          job_is_remote: false,
          job_apply_link: "https://apply.example/abc",
          job_description: "<p>Provide care</p>",
          job_posted_at_datetime_utc: "2026-06-01T00:00:00Z",
          job_min_salary: 50000,
          job_max_salary: 60000,
          job_salary_currency: "EUR",
          job_employment_type: "FULLTIME",
        },
        { job_title: "No Employer" }, // missing employer → filtered
      ],
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      title: "Registered Nurse",
      company: "Acme Health",
      location: "Dublin, IE",
      remote: false,
      url: "https://apply.example/abc",
      salaryText: "€50k–€60k",
      tags: ["fulltime"],
    });
    expect(jobs[0].description).not.toContain("<p>");
  });

  it("reports unavailable without a key", () => {
    expect(new JSearchSource(undefined).isConfigured).toBe(false);
    expect(new JSearchSource("rapidapi-key").isConfigured).toBe(true);
  });
});

describe("Apify LinkedIn provider", () => {
  it("normalizes dataset items across field-name variants", () => {
    const jobs = normalizeApifyJobs([
      { jobTitle: "Staff Nurse", companyName: "City Hospital", location: "Berlin", link: "https://l/1", descriptionText: "care", listedAt: 1717200000000 },
      { title: "RN", company: "Clinic", url: "https://l/2" },
      { company: "Ghost Co" }, // no title → filtered
    ]);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({ title: "Staff Nurse", company: "City Hospital", url: "https://l/1" });
    expect(jobs[1]).toMatchObject({ title: "RN", company: "Clinic", url: "https://l/2" });
    expect(typeof jobs[0].postedAt).toBe("string");
  });

  it("is OFF by default (no token) and on only with a token", () => {
    expect(new ApifyLinkedInSource(undefined).isConfigured).toBe(false);
    expect(new ApifyLinkedInSource("apify_xxx").isConfigured).toBe(true);
  });
});

describe("BLS labor provider", () => {
  it("is keyless (always configured) and labor-market capable", () => {
    const s = new BlsSource();
    expect(s.isConfigured).toBe(true);
    expect(s.capabilities).toContain("labor_market");
  });

  it("turns a labor snapshot into a ranked labor signal", () => {
    const signal = snapshotToSignal(
      { summary: "US labor market: unemployment 4.1% and steady.", asOf: "May 2026" },
      ["frontend", "react", "typescript"],
    );
    expect(signal).toMatchObject({
      sourceId: "bls",
      kind: "labor",
      regions: ["US", "United States"],
    });
    // The BLS period label is normalized to an ISO date for `publishedAt`.
    expect(signal?.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(new Date(signal!.publishedAt!).getUTCFullYear()).toBe(2026);
    // User terms ride along so the macro signal clears the relevance threshold.
    expect(signal?.skills).toEqual(["frontend", "react", "typescript"]);
  });

  it("emits nothing when there's no snapshot summary", () => {
    expect(snapshotToSignal({ summary: "", asOf: null }, ["x"])).toBeNull();
  });
});

describe("Lightcast Open Skills provider", () => {
  it("self-disables without both credentials", () => {
    expect(new LightcastSkillsSource().isConfigured).toBe(false);
    expect(new LightcastSkillsSource("id").isConfigured).toBe(false);
    expect(new LightcastSkillsSource("id", "secret").isConfigured).toBe(true);
  });

  it("builds a deduped, normalized skill_trend signal", () => {
    const signal = skillsToSignal(["React", " React ", "TypeScript", ""], ["frontend"]);
    expect(signal).toMatchObject({ sourceId: "lightcast", kind: "skill_trend" });
    expect(signal?.skills).toEqual(["React", "TypeScript"]);
    expect(signal?.title).toContain("frontend");
  });

  it("emits nothing when no skills were found", () => {
    expect(skillsToSignal([], ["frontend"])).toBeNull();
  });
});

describe("a source says when it does not cover a country", () => {
  it("THE REPORTED SILENCE: Adzuna reports no Ireland coverage instead of zero jobs", async () => {
    // Verified live 20 Sep 2026: https://api.adzuna.com/v1/api/jobs/ie/... → 404
    // UNSUPPORTED_COUNTRY, while the adapter returned [] and the board said "live, 0 jobs".
    const { AdzunaSource } = await import("./providers/adzuna");
    const adzuna = new AdzunaSource("id", "key");
    expect(adzuna.covers({ keywords: [], country: "ie", limit: 10 })).toBe("no");
    expect(adzuna.covers({ keywords: [], country: "gb", limit: 10 })).toBe("yes");
    expect(adzuna.covers({ keywords: [], country: "us", limit: 10 })).toBe("yes");
  });

  it("says unknown when no country was asked for", async () => {
    const { AdzunaSource } = await import("./providers/adzuna");
    expect(new AdzunaSource("id", "key").covers({ keywords: [], limit: 10 })).toBe("unknown");
  });
});

/**
 * A DEEP RUN MUST ACTUALLY ASK FOR DEPTH.
 *
 * The background crawl asks discoverJobs for 200 postings, and each board caps that at whatever
 * one page of its API will give — Adzuna 50, Reed 100, Jooble 50. Nothing in the code stops
 * someone "tidying" that limit back to the default 20, and the board would simply get thinner
 * with no test failing and no error anywhere. These pin the page size each board is asked for.
 */
describe("the boards are asked for a full page, not a default handful", () => {
  const asked = (url: string, param: string) => Number(new URL(url).searchParams.get(param));

  it("Adzuna asks for its maximum page, and clamps a larger request", async () => {
    const { AdzunaSource } = await import("./providers/adzuna");
    const calls: string[] = [];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    });
    try {
      await new AdzunaSource("app-id", "app-key").fetchJobs({
        keywords: ["it support"],
        country: "ie",
        limit: 200,
      } as never);
      await new AdzunaSource("app-id", "app-key").fetchJobs({
        keywords: ["it support"],
        country: "gb",
        limit: 200,
      } as never);
    } finally {
      fetchSpy.mockRestore();
    }
    expect(calls).toHaveLength(2);
    expect(calls.map((url) => asked(url, "results_per_page"))).toEqual([50, 50]);
  });

  it("Reed asks for its maximum page", async () => {
    const { ReedSource } = await import("./providers/reed");
    const calls: string[] = [];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    });
    try {
      await new ReedSource("key").fetchJobs({
        keywords: ["it support"],
        country: "gb",
        limit: 200,
      } as never);
    } finally {
      fetchSpy.mockRestore();
    }
    expect(calls).toHaveLength(1);
    expect(asked(calls[0], "resultsToTake")).toBe(100);
  });
});
