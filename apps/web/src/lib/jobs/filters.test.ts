import { describe, expect, it } from "vitest";

import { jobMatchesLocation, type FilterableJob } from "./filters";

const at = (location: string | null): FilterableJob => ({
  title: "SOC Analyst",
  location,
  remoteMode: null,
  employmentType: null,
  description: null,
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
