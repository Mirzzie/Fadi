import { describe, expect, it } from "vitest";

import {
  buildOutreachContext,
  fallbackOutreach,
  referralStrategy,
  RELATIONSHIP_LABEL,
  type OutreachInput,
} from "./outreach";

const base: OutreachInput = {
  company: "Stripe",
  roleTitle: "Product Designer",
  contactName: "Sam",
  contactRole: "Design Lead",
  relationship: "alumni",
};

describe("referralStrategy", () => {
  it("interpolates the company and gives multiple honest paths", () => {
    const tips = referralStrategy("Stripe");
    expect(tips.length).toBeGreaterThanOrEqual(4);
    expect(tips.join(" ")).toContain("Stripe");
    // It points at finding people, not at scraping the user's graph for them.
    expect(tips.join(" ")).toMatch(/alumni|2nd-degree|recruiter/i);
  });

  it("degrades gracefully without a company name", () => {
    expect(referralStrategy("").join(" ")).toContain("the company");
  });
});

describe("fallbackOutreach", () => {
  it("addresses the contact by name and includes a clear, low-pressure ask", () => {
    const msg = fallbackOutreach(base);
    expect(msg).toContain("Hi Sam");
    expect(msg).toContain("Stripe");
    expect(msg).toMatch(/no pressure/i);
  });

  it("uses a recruiter-appropriate ask", () => {
    const msg = fallbackOutreach({ ...base, relationship: "recruiter", contactName: null });
    expect(msg).toMatch(/quick chat/i);
  });

  it("never fabricates a name when none is given", () => {
    const msg = fallbackOutreach({ ...base, contactName: null });
    expect(msg).toMatch(/^Hi,/);
  });
});

describe("buildOutreachContext", () => {
  it("includes company, relationship label, and the target role", () => {
    const ctx = buildOutreachContext(base);
    expect(ctx).toContain("Stripe");
    expect(ctx).toContain(RELATIONSHIP_LABEL.alumni);
    expect(ctx).toContain("Product Designer");
  });
});
