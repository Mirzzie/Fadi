import { describe, expect, it } from "vitest";

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
      publishedAt: "May 2026",
      regions: ["US", "United States"],
    });
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
