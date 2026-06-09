import { describe, expect, it } from "vitest";

import { ApifyLinkedInSource, normalizeApifyJobs } from "./providers/apify-linkedin";
import { JSearchSource, normalizeJSearch } from "./providers/jsearch";

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
