import { describe, expect, it } from "vitest";

import {
  clientIp,
  isPortfolioEvent,
  looksAutomated,
  PORTFOLIO_EVENTS,
  visitorHash,
} from "./analytics";

const base = { siteId: "site-1", secret: "s3cret", ip: "203.0.113.9", userAgent: "Mozilla/5.0" };

describe("portfolio analytics — privacy model", () => {
  it("gives the same reader the same pseudonym within a day", () => {
    const day = new Date("2026-09-07T09:00:00Z");
    const evening = new Date("2026-09-07T23:30:00Z");

    expect(visitorHash({ ...base, now: day })).toBe(visitorHash({ ...base, now: evening }));
  });

  it("forgets them tomorrow — the pseudonym cannot follow anyone over time", () => {
    const today = visitorHash({ ...base, now: new Date("2026-09-07T09:00:00Z") });
    const tomorrow = visitorHash({ ...base, now: new Date("2026-09-08T09:00:00Z") });

    expect(today).not.toBe(tomorrow);
  });

  it("cannot be linked across two different portfolios", () => {
    // The same reader visiting two sites must not be joinable between owners.
    const now = new Date("2026-09-07T09:00:00Z");
    const onA = visitorHash({ ...base, siteId: "site-a", now });
    const onB = visitorHash({ ...base, siteId: "site-b", now });

    expect(onA).not.toBe(onB);
  });

  it("never contains the raw IP or user-agent it was derived from", () => {
    const hash = visitorHash({ ...base, now: new Date("2026-09-07T09:00:00Z") });

    expect(hash).not.toContain("203.0.113.9");
    expect(hash).not.toContain("Mozilla");
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is unguessable without the server secret", () => {
    const now = new Date("2026-09-07T09:00:00Z");

    expect(visitorHash({ ...base, secret: "one", now })).not.toBe(
      visitorHash({ ...base, secret: "two", now })
    );
  });

  it("separates different readers on the same day", () => {
    const now = new Date("2026-09-07T09:00:00Z");

    expect(visitorHash({ ...base, ip: "198.51.100.4", now })).not.toBe(
      visitorHash({ ...base, now })
    );
  });
});

describe("event vocabulary", () => {
  it("accepts only the closed set — the API must reject anything else", () => {
    for (const e of PORTFOLIO_EVENTS) expect(isPortfolioEvent(e)).toBe(true);

    for (const bad of ["", "drop_table", "view; delete", 1, null, undefined, {}]) {
      expect(isPortfolioEvent(bad)).toBe(false);
    }
  });

  it("is career-neutral — the names describe reading a page, not an industry", () => {
    // A midwife's portfolio and a joiner's must produce identical event names;
    // only the owner's own words appear in the payload.
    expect([...PORTFOLIO_EVENTS]).toEqual([
      "view",
      "item_opened",
      "persona_declared",
      "resume_downloaded",
      "contact_clicked",
    ]);
  });
});

describe("bot detection", () => {
  it("flags obvious automated traffic so counts can exclude it", () => {
    for (const ua of [
      "Googlebot/2.1 (+http://www.google.com/bot.html)",
      "curl/8.5.0",
      "python-requests/2.31",
      "HeadlessChrome/120",
      "facebookexternalhit/1.1",
    ]) {
      expect(looksAutomated(ua)).toBe(true);
    }
  });

  it("leaves real browsers alone", () => {
    expect(
      looksAutomated(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
      )
    ).toBe(false);
    expect(looksAutomated(null)).toBe(false);
  });
});

describe("clientIp", () => {
  it("takes the first hop from x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.9, 70.41.3.18, 150.172.238.178" });
    expect(clientIp(h)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip, then null", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIp(new Headers())).toBeNull();
  });
});
