import { describe, expect, it } from "vitest";
import { admitAgainst, toIdentity } from "./admit";
import type { Candidate } from "./admit";
const base: Candidate = {
  kind: "experience",
  title: "Support engineer",
  organization: "Acme",
  period: "2024",
  detail: "Resolved tickets",
  attribution: "employment",
};
const decide = (c: Candidate, pool = [toIdentity(base, "existing")]) =>
  admitAgainst(c, pool, (id) => ({ factId: id }));
describe("admission policy", () => {
  it("asks about the same employment and period even when a role rewrite changes all vocabulary", () => {
    const existing = { ...base, attribution: "personal" }; // legacy rows lacked attribution
    expect(
      decide({ ...base, title: "DevOps trainee", detail: "Maintained infrastructure" }, [
        toIdentity(existing, "e"),
      ])
    ).toMatchObject({ decision: "review" });
  });
  it("does not equate non-overlapping periods just because they share a year", () => {
    expect(
      decide(
        {
          ...base,
          title: "Warehouse assistant",
          detail: "Packed deliveries",
          period: "Aug 2024 - Dec 2024",
        },
        [toIdentity({ ...base, period: "Jan 2024 - Mar 2024" }, "e")]
      )
    ).toEqual({ decision: "create" });
  });
  it("recognises exact replay in a one-row corpus irrespective of ranking vocabulary", () => {
    expect(decide({ ...base, marketTags: ["devops"] })).toMatchObject({
      decision: "absorb",
      intoId: "existing",
    });
  });
  it("asks about a rewritten description without overwriting existing wording", () => {
    expect(decide({ ...base, detail: "Managed infrastructure incidents" })).toMatchObject({
      decision: "review",
    });
  });
  it.each(["organization", "period", "metrics", "attribution"] as const)(
    "does not silently accept changed %s",
    (key) => {
      expect(decide({ ...base, [key]: "different" })).toMatchObject({ decision: "review" });
    }
  );
  it("keeps projects and employment separate despite identical wording", () => {
    expect(decide({ ...base, kind: "project" })).toEqual({ decision: "create" });
  });
  it("does not use pending candidates as identity anchors", () => {
    expect(
      admitAgainst({ ...base, detail: "Changed" }, [toIdentity(base, "p")], () => ({
        factId: "p",
        reviewStatus: "pending",
      }))
    ).toEqual({ decision: "create" });
  });
  it("can replay a pending candidate without creating another row", () => {
    expect(
      admitAgainst(base, [toIdentity(base, "p")], () => ({ factId: "p", reviewStatus: "pending" }))
    ).toMatchObject({ decision: "absorb", intoId: "p" });
  });
  it("does not use an archived rendering as a new semantic anchor", () => {
    expect(
      admitAgainst({ ...base, detail: "Changed" }, [toIdentity(base, "r")], () => ({
        factId: "f",
        isCanonical: false,
      }))
    ).toEqual({ decision: "create" });
  });
  it("ranks matching employer and dates ahead of a same-title job at another company", () => {
    const pool = [toIdentity({ ...base, organization: "Other employer" }, "wrong"), toIdentity(base, "right")];
    expect(decide({ ...base, detail: "Rewritten for DevOps" }, pool)).toMatchObject({ decision: "review", intoId: "right" });
  });
  it("market keywords cannot manufacture identity", () => {
    expect(
      toIdentity({ ...base, tags: ["tickets"], marketTags: ["aws", "terraform"] }, "a").tags
    ).toEqual(["tickets"]);
  });
});
