import { describe, expect, it } from "vitest";

import { composeDigestMessage, composeDigestSubline } from "./digest-format";

const newRole = {
  kind: "new_role",
  title: "Care Coordinator at HealthBridge",
  detail: "Strong match on patient-advocacy experience",
};
const expired = {
  kind: "expired_saved_role",
  title: "Operations Lead at Northwind looks closed",
  detail: "This posting stopped appearing on its source boards.",
};
const signal = { kind: "market_signal", title: "Logistics hiring up in your region", detail: null };

describe("composeDigestMessage", () => {
  it("includes each finding verbatim and nothing invented", () => {
    const msg = composeDigestMessage([newRole, expired, signal]);
    expect(msg).toContain("Care Coordinator at HealthBridge");
    expect(msg).toContain("Strong match on patient-advocacy experience");
    expect(msg).toContain("Operations Lead at Northwind looks closed");
    expect(msg).toContain("Logistics hiring up in your region");
  });

  it("groups by kind with the right sections", () => {
    const msg = composeDigestMessage([newRole, expired]);
    expect(msg).toContain("New matched role");
    expect(msg).toContain("Heads up");
    expect(msg).not.toContain("Market signal");
  });

  it("pluralizes correctly", () => {
    const msg = composeDigestMessage([newRole, { ...newRole, title: "Another at Elsewhere" }]);
    expect(msg).toContain("New matched roles");
  });
});

describe("composeDigestSubline", () => {
  it("counts each kind", () => {
    const line = composeDigestSubline([newRole, newRole, expired, signal]);
    expect(line).toContain("2 new matched roles");
    expect(line).toContain("1 saved posting that looks closed");
    expect(line).toContain("1 market signal");
  });

  it("singular forms read naturally", () => {
    const line = composeDigestSubline([newRole]);
    expect(line).toContain("1 new matched role");
    expect(line).not.toContain("roles");
  });
});

describe("coherence findings in the digest", () => {
  const gap = {
    kind: "portfolio_gap",
    title: "IT Support Consultant isn't on your portfolio",
    detail: "Your résumé has this at Spark Technomedia (Jan 2026 – Aug 2026).",
  };
  const dupe = { kind: "portfolio_duplicate", title: "Two entries look like the same project", detail: null };

  it("files them under the user's own record, not under market news", () => {
    const msg = composeDigestMessage([gap, dupe]);

    expect(msg).toContain("Your own record");
    expect(msg).toContain("IT Support Consultant");
    expect(msg).not.toContain("Bigger picture");
  });

  it("counts them in the spoken subline", () => {
    expect(composeDigestSubline([gap, dupe])).toMatch(/2 things to fix in your own record/);
  });

  it("says so plainly when a pass found nothing", () => {
    // The old subline built a sentence around an empty list: "I found . The details
    // are in our chat." Nothing found is a real result and has to read like one.
    expect(composeDigestSubline([])).toBe(
      "While you were away I ran a pass and found nothing new.",
    );
  });
});
