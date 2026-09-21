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

  it("a city search DOES accept a country-level posting (no specific city)", () => {
    // "Systems Engineer — Ireland" is relevant to a Dublin search; a different named city is not.
    expect(jobMatchesLocation(at("Ireland"), "ie", "Dublin")).toBe(true);
    expect(jobMatchesLocation(at("Remote - Ireland"), "ie", "Dublin")).toBe(true);
    expect(jobMatchesLocation(at("Cork, Ireland"), "ie", "Dublin")).toBe(false);
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

describe("a remote role still has to be one you could take", () => {
  const remote = (location: string, title = "IT Systems Administrator") => ({
    title,
    location,
    remoteMode: "remote",
    employmentType: null,
    description: null,
  });
  const dublin = { country: "ie", city: "Dublin" };

  it("THE REPORTED BOARD: a bare 'Remote' US role no longer tops a Dublin search", () => {
    // Reproduced 20 Sep: "IT Systems Administrator @ Epic — Remote" ranked first for an
    // entry-level seeker in Ireland, above a real Dublin deskside role.
    expect(passesFilters(remote("Remote"), dublin)).toBe(false);
    expect(passesFilters(remote("Remote — United States"), dublin)).toBe(false);
    expect(passesFilters({ ...remote("Berlin"), title: "Unsolicited application" }, dublin)).toBe(false);
  });

  it("keeps remote roles that say they can be done from there", () => {
    expect(passesFilters(remote("Remote — Ireland"), dublin)).toBe(true);
    expect(passesFilters(remote("Remote (EMEA)"), dublin)).toBe(true);
    expect(passesFilters(remote("Europe"), dublin)).toBe(true);
    expect(passesFilters(remote("Worldwide"), dublin)).toBe(true);
    expect(passesFilters(remote("Remote — Dublin"), dublin)).toBe(true);
  });

  it("asking for remote explicitly still shows unplaced remote roles", () => {
    expect(passesFilters(remote("Remote"), { ...dublin, modes: ["remote"] })).toBe(true);
  });

  it("a search with no location is unaffected", () => {
    expect(passesFilters(remote("Remote"), {})).toBe(true);
  });

  it("onsite and hybrid roles are unchanged — they must sit in the place", () => {
    const onsite = { title: "Deskside Support", location: "Dublin", remoteMode: null, employmentType: null, description: null };
    expect(passesFilters(onsite, dublin)).toBe(true);
    expect(passesFilters({ ...onsite, location: "Cork, Ireland" }, dublin)).toBe(false);
  });
});

describe("the words you typed are part of the search", () => {
  const job = (title: string, description: string | null = null): FilterableJob => ({
    title,
    location: "Dublin",
    remoteMode: null,
    employmentType: null,
    description,
  });

  it("THE REPORTED SEARCH: 'graduate IT support in Dublin' keeps support roles, drops the rest", () => {
    // Reproduced 20 Sep: only the location survived the search box, so the board still showed
    // the active direction's roles — the typed words changed nothing.
    const filters = { country: "ie", city: "Dublin", keywords: ["IT support"] };
    expect(passesFilters(job("IT Support Specialist"), filters)).toBe(true);
    expect(passesFilters(job("Engineering Manager, Server Networking"), filters)).toBe(false);
  });

  it("matches on the description as well as the title, case-insensitively", () => {
    const filters = { keywords: ["kubernetes"] };
    expect(passesFilters(job("Platform Engineer", "You will run Kubernetes clusters."), filters)).toBe(true);
    expect(passesFilters(job("Platform Engineer", "Mostly Terraform."), filters)).toBe(false);
  });

  it("any one word is enough, and no words changes nothing", () => {
    expect(passesFilters(job("Service Desk Analyst"), { keywords: ["helpdesk", "service desk"] })).toBe(true);
    expect(passesFilters(job("Service Desk Analyst"), { keywords: [] })).toBe(true);
    expect(passesFilters(job("Service Desk Analyst"), {})).toBe(true);
  });
});

describe("an employment-type filter cannot empty the board on silence", () => {
  const job = (title: string, description: string | null = null): FilterableJob => ({
    title,
    location: "Dublin",
    remoteMode: null,
    employmentType: null,
    description,
  });

  it("THE REPORTED EMPTY BOARD: postings that state no type survive a full-time filter", () => {
    // Measured 20 Sep: 1,063 of 1,249 live postings state no employment type, so the saved
    // "full-time" preference took a 20-job Dublin board to zero.
    expect(passesFilters(job("Deskside Support Engineer"), { types: ["full-time"] })).toBe(true);
  });

  it("a posting that states a different type is still excluded", () => {
    expect(passesFilters(job("Support Engineer (6 month contract)"), { types: ["full-time"] })).toBe(false);
    expect(passesFilters(job("Part-time Service Desk Analyst"), { types: ["full-time"] })).toBe(false);
  });

  it("a stated match still passes", () => {
    expect(passesFilters(job("Service Desk Analyst", "This is a permanent, full-time role."), { types: ["full-time"] })).toBe(true);
  });
});
