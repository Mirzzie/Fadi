import { describe, expect, it } from "vitest";

import { jobMatchesLocation, passesFilters, type FilterableJob } from "./filters";

const at = (location: string | null): FilterableJob => ({
  title: "SOC Analyst",
  location,
  remoteMode: null,
  employmentType: null,
  description: null,
});

const job = (over: Partial<FilterableJob>): FilterableJob => ({
  title: "SOC Analyst",
  location: null,
  remoteMode: null,
  employmentType: "full-time",
  description: null,
  ...over,
});

describe("jobMatchesLocation", () => {
  it("a city search returns only that city — not other cities in the same country", () => {
    // The bug: a Dublin search was surfacing Carlow / Blanchardstown roles because
    // they matched the country ("Ireland") even though the city differs.
    expect(jobMatchesLocation(at("Dublin, County Dublin, Ireland"), "ie", "Dublin")).toBe(true);
    expect(jobMatchesLocation(at("Carlow, County Carlow, Ireland"), "ie", "Dublin")).toBe(false);
    expect(jobMatchesLocation(at("Blanchardstown, Fingal, Ireland"), "ie", "Dublin")).toBe(false);
  });

  it("a country-only search matches anywhere in the country", () => {
    expect(jobMatchesLocation(at("Carlow, County Carlow, Ireland"), "ie", undefined)).toBe(true);
    expect(jobMatchesLocation(at("Berlin, Germany"), "ie", undefined)).toBe(false);
  });

  it("no filter passes everything", () => {
    expect(jobMatchesLocation(at("Anywhere"), undefined, undefined)).toBe(true);
    expect(jobMatchesLocation(at(null), undefined, undefined)).toBe(true);
  });

  it("city match is case-insensitive", () => {
    expect(jobMatchesLocation(at("DUBLIN, IE"), "ie", "dublin")).toBe(true);
  });
});

describe("passesFilters — remote + city conflict", () => {
  const remoteJob = job({ location: "Remote", remoteMode: "remote" });
  const dublinOnsite = job({ location: "Dublin, Ireland", remoteMode: "onsite" });
  const corkOnsite = job({ location: "Cork, Ireland", remoteMode: "onsite" });

  it("shows a REMOTE role for a city search when Remote is an accepted mode", () => {
    // The bug: Remote selected + Dublin typed dropped every remote job → 0 results.
    const f = { country: "ie", city: "Dublin", modes: ["remote", "hybrid", "onsite"] as const };
    expect(passesFilters(remoteJob, { ...f, modes: [...f.modes] })).toBe(true);
    expect(passesFilters(dublinOnsite, { ...f, modes: [...f.modes] })).toBe(true);
    expect(passesFilters(corkOnsite, { ...f, modes: [...f.modes] })).toBe(false); // wrong city, onsite
  });

  it("still excludes remote when the user only wants on-site", () => {
    expect(passesFilters(remoteJob, { country: "ie", city: "Dublin", modes: ["onsite"] })).toBe(false);
  });
});
