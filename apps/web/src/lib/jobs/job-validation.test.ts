import { describe, expect, it } from "vitest";

import { isExpired, isLegitJob, looksLikeScam } from "./job-validation";

describe("isExpired", () => {
  it("flags a posting past its validThrough date", () => {
    expect(isExpired({ title: "X", validThrough: "2020-01-01" })).toBe(true);
  });
  it("keeps a future/undated posting", () => {
    expect(isExpired({ title: "X", validThrough: "2999-01-01" })).toBe(false);
    expect(isExpired({ title: "X" })).toBe(false);
  });
  it("flags 'no longer available' in the text", () => {
    expect(isExpired({ title: "X", description: "This job is no longer available." })).toBe(true);
    expect(isExpired({ title: "X", description: "Applications are closed." })).toBe(true);
  });
});

describe("looksLikeScam", () => {
  it("flags the classic survey / earn-per-hour trap", () => {
    expect(
      looksLikeScam({ title: "Cash In Hand (€20/hour) - Earn €10 Per Survey", description: "Complete surveys, no experience needed, work from home. Unlimited earnings." }),
    ).toBe(true);
  });
  it("flags a blatant short lead-gen post", () => {
    expect(looksLikeScam({ title: "Paid surveys from home", description: "Earn now." })).toBe(true);
  });
  it("does NOT flag a genuine IT posting", () => {
    expect(
      looksLikeScam({
        title: "IT Support Engineer",
        description: "Provide first and second line support, Windows 11 deployment, Active Directory. 2+ years experience.",
      }),
    ).toBe(false);
  });
});

describe("isLegitJob", () => {
  it("keeps a real, open job; drops expired and scam", () => {
    expect(isLegitJob({ title: "Systems Administrator", description: "Manage Linux servers." })).toBe(true);
    expect(isLegitJob({ title: "X", validThrough: "2020-01-01" })).toBe(false);
    expect(isLegitJob({ title: "Paid surveys", description: "unlimited income, no experience" })).toBe(false);
    expect(isLegitJob({ description: "no title" })).toBe(false);
  });
});
