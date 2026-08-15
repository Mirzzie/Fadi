import { describe, expect, it } from "vitest";

import {
  annualizeSalary,
  canonicalCompany,
  canonicalTitle,
  dedupeJobs,
  dedupeWithinSource,
  inferRemote,
  inferSalaryInterval,
  normalizeJobType,
  normalizePosting,
} from "./normalize";
import type { JobPosting } from "./types";

function posting(over: Partial<JobPosting> = {}): JobPosting {
  return {
    sourceId: "test",
    externalId: "1",
    title: "Software Engineer",
    company: "Acme",
    tags: [],
    ...over,
  };
}

describe("normalizeJobType", () => {
  it("maps each board's phrasing onto one vocabulary", () => {
    expect(normalizeJobType("Full-time")).toBe("fulltime");
    expect(normalizeJobType("FULLTIME")).toBe("fulltime");
    expect(normalizeJobType("Permanent")).toBe("fulltime");
    expect(normalizeJobType("Part Time")).toBe("parttime");
    expect(normalizeJobType("Contractor")).toBe("contract");
  });

  it("does not match a synonym inside a longer word", () => {
    // The reason this uses word boundaries: an "Internal Communications Manager"
    // must never be classified as an internship.
    expect(normalizeJobType("Internal Communications")).toBeNull();
  });

  it("returns null for unknown types rather than defaulting to fulltime", () => {
    // A wrong default would make a contract-only filter return permanent roles.
    expect(normalizeJobType("Something Else")).toBeNull();
    expect(normalizeJobType("")).toBeNull();
    expect(normalizeJobType(null)).toBeNull();
  });
});

describe("annualizeSalary", () => {
  it("puts every interval on an annual basis so they compare", () => {
    expect(annualizeSalary(50000, "yearly")).toBe(50000);
    expect(annualizeSalary(5000, "monthly")).toBe(60000);
    expect(annualizeSalary(30, "hourly")).toBe(62400); // 30 × 2080
    expect(annualizeSalary(500, "daily")).toBe(130000); // 500 × 260
  });

  it("ranks an hourly contract above a lower annual salary", () => {
    // The bug this prevents: raw-number sorting puts £25,000/yr above £30/hr.
    const hourly = annualizeSalary(30, "hourly")!;
    const yearly = annualizeSalary(25000, "yearly")!;
    expect(hourly).toBeGreaterThan(yearly);
  });

  it("returns null when the interval is unknown, rather than assuming yearly", () => {
    expect(annualizeSalary(30, null)).toBeNull();
    expect(annualizeSalary(0, "yearly")).toBeNull();
  });
});

describe("inferSalaryInterval", () => {
  it("reads the interval out of prose", () => {
    expect(inferSalaryInterval("£45,000 per annum")).toBe("yearly");
    expect(inferSalaryInterval("$30 an hour")).toBe("hourly");
    expect(inferSalaryInterval("€400 / day")).toBe("daily");
    expect(inferSalaryInterval("£3,500 pcm")).toBe("monthly");
  });

  it("reads slash-abbreviated intervals", () => {
    // Regression: a leading \b before "/" never matches, so every slash form
    // ("/hr", "/ day", "/yr") silently returned null.
    expect(inferSalaryInterval("$30/hr")).toBe("hourly");
    expect(inferSalaryInterval("$30 / hour")).toBe("hourly");
    expect(inferSalaryInterval("€500/day")).toBe("daily");
    expect(inferSalaryInterval("£4,000/mo")).toBe("monthly");
    expect(inferSalaryInterval("£70,000/yr")).toBe("yearly");
  });

  it("returns null when the text states no interval", () => {
    expect(inferSalaryInterval("competitive")).toBeNull();
    expect(inferSalaryInterval("£45,000 - £55,000")).toBeNull();
  });
});

describe("inferRemote", () => {
  it("detects remote from any field", () => {
    expect(inferRemote({ title: "Engineer (Remote)" })).toBe(true);
    expect(inferRemote({ location: "Remote - UK" })).toBe(true);
    expect(inferRemote({ description: "This role is work from home." })).toBe(true);
  });

  it("does not treat hybrid as remote", () => {
    // Someone filtering for remote is filtering out commuting; hybrid still commutes.
    expect(inferRemote({ title: "Engineer", location: "Hybrid - remote 2 days" })).toBe(false);
  });

  it("is false when nothing suggests remote", () => {
    expect(inferRemote({ title: "Engineer", location: "Dublin" })).toBe(false);
    expect(inferRemote({})).toBe(false);
  });
});

describe("canonicalCompany", () => {
  it("collapses legal suffixes and punctuation", () => {
    expect(canonicalCompany("Acme, Inc.")).toBe("acme");
    expect(canonicalCompany("ACME Inc")).toBe("acme");
    expect(canonicalCompany("Acme Limited")).toBe("acme");
    expect(canonicalCompany("Acme Holdings Ltd")).toBe("acme holdings");
  });

  it("does not strip a suffix that is part of the name", () => {
    expect(canonicalCompany("Incorporated Systems")).toBe("incorporated systems");
  });
});

describe("canonicalTitle", () => {
  it("strips requisition ids and gender tags", () => {
    expect(canonicalTitle("Software Engineer (m/w/d)")).toBe("software engineer");
    expect(canonicalTitle("Software Engineer - REQ12345")).toBe("software engineer");
    expect(canonicalTitle("Software Engineer | Dublin")).toBe("software engineer dublin");
  });
});

describe("dedupeJobs", () => {
  it("collapses the same job posted under different company spellings", () => {
    // This is the case the old `company::title` key missed entirely: the user saw
    // the identical job three times because three boards punctuate the name differently.
    const result = dedupeJobs([
      posting({ sourceId: "adzuna", company: "Acme, Inc.", location: "Dublin" }),
      posting({ sourceId: "linkedin-guest", company: "Acme Inc", location: "Dublin" }),
      posting({ sourceId: "reed", company: "ACME", location: "Dublin" }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("keeps the first source's attribution", () => {
    const result = dedupeJobs([
      posting({ sourceId: "adzuna", company: "Acme, Inc." }),
      posting({ sourceId: "linkedin-guest", company: "Acme" }),
    ]);
    expect(result[0].sourceId).toBe("adzuna");
  });

  it("fills the survivor's gaps from the duplicate", () => {
    // A LinkedIn card carries no description; the Adzuna copy does. The user should
    // end up with both, not with whichever happened to arrive first.
    const result = dedupeJobs([
      posting({ sourceId: "linkedin-guest", company: "Acme", url: "https://li/1" }),
      posting({
        sourceId: "adzuna",
        company: "Acme",
        description: "Full description here",
        salaryMin: 50000,
        salaryCurrency: "EUR",
      }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe("linkedin-guest");
    expect(result[0].url).toBe("https://li/1");
    expect(result[0].description).toBe("Full description here");
    expect(result[0].salaryMin).toBe(50000);
  });

  it("unions tags and skills across duplicates", () => {
    const result = dedupeJobs([
      posting({ company: "Acme", tags: ["react"], skills: ["TypeScript"] }),
      posting({ company: "Acme", tags: ["remote"], skills: ["React"] }),
    ]);
    expect(result[0].tags).toEqual(expect.arrayContaining(["react", "remote"]));
    expect(result[0].skills).toEqual(expect.arrayContaining(["TypeScript", "React"]));
  });

  it("keeps the FULLER description, not merely the first one", () => {
    // Real bug: Jooble arrives first with a ~270-char teaser and won; the full-JD copy
    // from another board was discarded, so the card showed almost no description.
    const teaser = "Field Security Engineer to join our team. Apply now.";
    const full = "Field Security Engineer ".repeat(200); // the real ~4k posting
    const result = dedupeJobs([
      posting({ sourceId: "jooble", company: "Atlan", description: teaser }),
      posting({ sourceId: "adzuna", company: "Atlan", description: full }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe("jooble"); // first-wins attribution preserved
    expect(result[0].description).toBe(full); // …but the body is the fuller one
  });

  it("keeps genuinely different roles apart", () => {
    const result = dedupeJobs([
      posting({ company: "Acme", title: "Software Engineer", location: "Dublin" }),
      posting({ company: "Acme", title: "Product Manager", location: "Dublin" }),
      // Same title, different city — a real second opening, not a duplicate.
      posting({ company: "Acme", title: "Software Engineer", location: "London" }),
    ]);
    expect(result).toHaveLength(3);
  });
});

describe("dedupeWithinSource", () => {
  it("PRESERVES the same vacancy from different providers (each must become an occurrence)", () => {
    // The release-blocker regression: cross-source dedupe before persistence meant only one
    // provider's posting ever reached the DB, so no job had multi-source occurrences.
    const result = dedupeWithinSource([
      posting({ sourceId: "jooble", externalId: "j1", company: "Acme", location: "Dublin" }),
      posting({ sourceId: "adzuna", externalId: "a1", company: "Acme", location: "Dublin" }),
      posting({ sourceId: "reed", externalId: "r1", company: "Acme", location: "Dublin" }),
    ]);
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.sourceId).sort()).toEqual(["adzuna", "jooble", "reed"]);
  });

  it("collapses a single source's exact repeat (same external id)", () => {
    const result = dedupeWithinSource([
      posting({ sourceId: "jooble", externalId: "j1", company: "Acme, Inc.", location: "Dublin" }),
      posting({ sourceId: "jooble", externalId: "j1", company: "Acme", location: "Dublin" }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("KEEPS two distinct requisitions from one source (same title, different external id)", () => {
    // Stable identity first: a provider can list two different roles with an identical
    // title/company/location — they must not merge before persistence.
    const result = dedupeWithinSource([
      posting({
        sourceId: "jooble",
        externalId: "req-1",
        title: "Engineer",
        company: "Acme",
        location: "Dublin",
      }),
      posting({
        sourceId: "jooble",
        externalId: "req-2",
        title: "Engineer",
        company: "Acme",
        location: "Dublin",
      }),
    ]);
    expect(result).toHaveLength(2);
  });

  it("falls back to canonical URL, then content, when a source gives no external id", () => {
    const result = dedupeWithinSource([
      posting({
        sourceId: "x",
        externalId: undefined,
        url: "https://x.com/j/9?utm_source=a",
        company: "Acme",
        location: "Dublin",
      }),
      posting({
        sourceId: "x",
        externalId: undefined,
        url: "https://x.com/j/9?utm_source=b",
        company: "Acme",
        location: "Dublin",
      }),
    ]);
    expect(result).toHaveLength(1); // same canonical URL (tracking stripped) → one
  });
});

describe("normalizePosting", () => {
  it("derives interval and annual figure from prose salary", () => {
    const result = normalizePosting(
      posting({ salaryText: "$30 per hour", salaryMin: 30, salaryMax: 40 })
    );
    expect(result.salaryInterval).toBe("hourly");
    expect(result.salaryAnnualMin).toBe(62400);
  });

  it("does not override an interval the source stated", () => {
    const result = normalizePosting(
      posting({ salaryInterval: "yearly", salaryMin: 60000, salaryText: "60000" })
    );
    expect(result.salaryInterval).toBe("yearly");
    expect(result.salaryAnnualMin).toBe(60000);
  });

  it("leaves the annual figure absent when the interval is unknowable", () => {
    // Better to show the posting as unfilterable than to invent an annual number.
    const result = normalizePosting(posting({ salaryText: "competitive", salaryMin: 500 }));
    expect(result.salaryAnnualMin).toBeUndefined();
  });

  it("infers remote when the source gave no flag", () => {
    const result = normalizePosting(posting({ title: "Engineer (Remote)" }));
    expect(result.remote).toBe(true);
  });
});
