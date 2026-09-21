import { describe, expect, it } from "vitest";

import { keywordMatches, matchesAnyKeyword } from "./keyword-match";

const post = (title: string, description = "") => ({ title, description });

describe("keywordMatches", () => {
  it("matches the phrase as written, in the title or the description", () => {
    expect(keywordMatches(post("IT Support Specialist II"), "it support")).toBe(true);
    expect(keywordMatches(post("Service Desk Analyst", "Second-line IT support for 400 staff"), "it support")).toBe(true);
  });

  it("matches the same words reordered in the title — the live miss this fixes", () => {
    expect(keywordMatches(post("Support Engineer, IT Services"), "it support")).toBe(true);
    expect(keywordMatches(post("Engineer, Cloud Infrastructure"), "cloud engineer")).toBe(true);
  });

  it("does not let prose in the description assemble the phrase", () => {
    // Measured live: this exact posting was kept for "it support" because the JD says "it" and
    // "support" like every other JD.
    expect(
      keywordMatches(
        post("Senior Privacy Counsel", "You will support the team as it scales across the EU."),
        "it support"
      )
    ).toBe(false);
  });

  it("needs every word of the phrase, not just one", () => {
    expect(keywordMatches(post("Sales Engineer"), "cloud engineer")).toBe(false);
    expect(keywordMatches(post("Cloud Account Executive"), "cloud engineer")).toBe(false);
  });

  it("keeps a single word literal, so 'ops' does not match 'operations'", () => {
    expect(keywordMatches(post("DevOps Engineer"), "devops")).toBe(true);
    expect(keywordMatches(post("Operations Manager"), "ops")).toBe(false);
  });

  it("ignores empty keywords and answers any-of", () => {
    expect(keywordMatches(post("anything"), "   ")).toBe(false);
    expect(matchesAnyKeyword(post("IT Support Specialist"), ["azure", "it support"])).toBe(true);
    expect(matchesAnyKeyword(post("IT Support Specialist"), ["azure", "terraform"])).toBe(false);
  });
});
