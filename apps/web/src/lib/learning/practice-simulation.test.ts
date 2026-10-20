import { describe, expect, it } from "vitest";
import { installedActivities } from "@/lib/practice/packs";
import { practiceSimulation } from "./practice-simulation";

describe("the single optional simulation on Learning", () => {
  it.each([
    "SOC analyst",
    "IT support",
    "Cloud operations",
    "Infrastructure engineer",
    "IAM analyst",
    "IT operations engineer",
    "Cloud engineer",
  ])("shows the installed identity incident for %s", (role) => {
    expect(practiceSimulation({ role }, installedActivities())?.href).toBe(
      "/dashboard/learning/practice/fadi.security-operations/suspicious-sign-ins"
    );
  });

  it.each([
    "Retail manager",
    "HR coordinator",
    "Digital marketing",
    "Security guard",
    "IT recruiter",
    "Cloud sales",
    "Cloud account executive",
    "Cybersecurity recruiter",
    "IT",
    "Cloud",
  ])("keeps the business sample for %s", (role) => {
    expect(practiceSimulation({ role }, installedActivities())?.href).toBe(
      "/dashboard/learning/practice/fadi.customer-success/churn-review"
    );
  });

  it("does not mistake a technical industry for a business person's job function", () => {
    expect(
      practiceSimulation({ role: "IT recruiter", domain: "Cybersecurity" }, installedActivities())
        ?.href
    ).toContain("fadi.customer-success");
  });

  it("uses the active domain when the role is abbreviated", () => {
    expect(
      practiceSimulation({ role: "Analyst", domain: "Cybersecurity" }, installedActivities())?.href
    ).toContain("fadi.security-operations");
  });

  it("does not invent a route when a matching pack is not installed", () => {
    expect(practiceSimulation({ role: "SOC analyst" }, [])).toBeNull();
  });

  it("keeps experimental status and catalogue copy without a release recommendation", () => {
    const entry = installedActivities().find((item) => item.pack.domain.id === "customer-success")!;
    expect(practiceSimulation({}, installedActivities())).toMatchObject({
      title: entry.activity.title,
      description: entry.activity.outcome,
      experimental: true,
    });
  });
});
