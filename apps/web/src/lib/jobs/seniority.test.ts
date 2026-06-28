import { describe, expect, it } from "vitest";

import {
  parseRequiredYears,
  requiredLevel,
  seniorityFit,
  userLevel,
  yearsToLevel,
} from "./seniority";

describe("parseRequiredYears", () => {
  it("reads years tied to experience", () => {
    expect(parseRequiredYears("at least 8-10 years of experience in developing security tooling")).toBe(8);
    expect(parseRequiredYears("minimum 5 years experience")).toBe(5);
    expect(parseRequiredYears("3+ years of professional experience")).toBe(3);
  });

  it("ignores numbers not tied to experience", () => {
    expect(parseRequiredYears("over the last 3 years we grew rapidly")).toBeNull();
    expect(parseRequiredYears("covering 50 countries")).toBeNull();
  });
});

describe("requiredLevel", () => {
  it("reads seniority from the title", () => {
    expect(requiredLevel("Staff Security Engineer, SOAR")).toBe(4);
    expect(requiredLevel("Senior SOC Analyst")).toBe(3);
    expect(requiredLevel("Junior SOC Analyst")).toBe(1);
    expect(requiredLevel("Head of Security")).toBe(5);
  });

  it("falls back to JD years when the title is level-neutral", () => {
    expect(requiredLevel("SOC Analyst", "requires 8-10 years of experience")).toBe(yearsToLevel(8));
  });

  it("is null when neither title nor JD signals a level", () => {
    expect(requiredLevel("SOC Analyst", "join our team")).toBeNull();
  });
});

describe("userLevel", () => {
  it("maps stored experience levels", () => {
    expect(userLevel("entry")).toBe(0);
    expect(userLevel("mid_level")).toBe(2);
    expect(userLevel("senior")).toBe(3);
    expect(userLevel(null)).toBeNull();
  });
});

describe("seniorityFit", () => {
  it("flags an 8–10-year Staff role as over-reach for an early-career profile", () => {
    const fit = seniorityFit(
      "Staff Security Engineer, SOAR",
      "You have at least 8-10 years of experience in developing security tooling",
      "entry",
    );
    expect(fit.overReach).toBe(true);
    expect(fit.note).toBeTruthy();
  });

  it("a same-level role is not over-reach", () => {
    expect(seniorityFit("SOC Analyst", "2+ years of experience", "mid").overReach).toBe(false);
    expect(seniorityFit("Senior SOC Analyst", null, "senior").overReach).toBe(false);
  });

  it("never penalises when either side is unknown", () => {
    expect(seniorityFit("Staff Engineer", null, null).overReach).toBe(false);
    expect(seniorityFit("SOC Analyst", "join us", "entry").overReach).toBe(false);
  });
});
