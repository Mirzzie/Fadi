import { describe, expect, it } from "vitest";

import {
  canonicalizeUrl,
  canonicalJobKey,
  canonicalOccurrenceJobKey,
  stableExternalId,
} from "@careeros/database";

describe("canonicalJobKey", () => {
  it("collapses legal-suffix and punctuation variants of the same company", () => {
    const a = canonicalJobKey("Stripe, Inc.", "Software Engineer", "Dublin");
    const b = canonicalJobKey("Stripe", "software engineer", "Dublin");
    expect(a).toBe(b);
  });

  it("treats 'Dublin' and 'Dublin, Ireland' as the same city", () => {
    expect(canonicalJobKey("Acme", "SRE", "Dublin")).toBe(
      canonicalJobKey("Acme", "SRE", "Dublin, Ireland")
    );
  });

  it("keeps genuinely different roles / cities apart", () => {
    expect(canonicalJobKey("Acme", "Software Engineer", "Dublin")).not.toBe(
      canonicalJobKey("Acme", "Product Manager", "Dublin")
    );
    expect(canonicalJobKey("Acme", "Software Engineer", "Dublin")).not.toBe(
      canonicalJobKey("Acme", "Software Engineer", "London")
    );
  });
});

describe("canonicalOccurrenceJobKey", () => {
  it("D12: preserves distinct requisitions with the same company, title and city", () => {
    const first = canonicalOccurrenceJobKey("Acme", "Support Engineer", "Dublin", "board", "req-1");
    const second = canonicalOccurrenceJobKey(
      "Acme",
      "Support Engineer",
      "Dublin",
      "board",
      "req-2"
    );

    expect(first).not.toBe(second);
  });

  it("normalizes the source name but preserves the provider identifier", () => {
    expect(
      canonicalOccurrenceJobKey("Acme", "Support Engineer", "Dublin", " Board ", "Req-A")
    ).toBe(canonicalOccurrenceJobKey("Acme", "Support Engineer", "Dublin", "board", "Req-A"));
    expect(
      canonicalOccurrenceJobKey("Acme", "Support Engineer", "Dublin", "board", "Req-A")
    ).not.toBe(canonicalOccurrenceJobKey("Acme", "Support Engineer", "Dublin", "board", "req-a"));
  });
});

describe("canonicalizeUrl", () => {
  it("reduces an Indeed clk URL with rotating params to its stable jk", () => {
    const a = canonicalizeUrl(
      "https://ie.indeed.com/rc/clk?jk=f92eb9cadcfe7413&bb=ROTATING1&xkcb=X1&fccid=abc&vjs=3"
    );
    const b = canonicalizeUrl(
      "https://ie.indeed.com/rc/clk?jk=f92eb9cadcfe7413&bb=ROTATING2&xkcb=X2&fccid=def&vjs=3"
    );
    expect(a).toBe("https://ie.indeed.com/viewjob?jk=f92eb9cadcfe7413");
    expect(a).toBe(b); // the two crawls now map to ONE url → one row
  });

  it("strips utm/gclid tracking and normalizes host + trailing slash", () => {
    expect(
      canonicalizeUrl("https://www.Example.com/careers/123/?utm_source=li&gclid=xyz&team=infra")
    ).toBe("https://example.com/careers/123?team=infra");
  });

  it("keeps functional (non-tracking) params like source/ref that some ATS boards need", () => {
    const out = canonicalizeUrl(
      "https://boards.greenhouse.io/acme/jobs/42?source=careers&ref=team"
    );
    expect(out).toContain("source=careers");
    expect(out).toContain("ref=team");
  });

  it("percent-encodes values correctly (a nested redirect URL survives, not corrupted)", () => {
    const out = canonicalizeUrl(
      "https://jobs.example.com/apply?redirect=" + encodeURIComponent("https://x.com/p?a=1&b=2")
    );
    // Round-trips back to the exact nested URL rather than splitting into stray params.
    expect(new URL(out!).searchParams.get("redirect")).toBe("https://x.com/p?a=1&b=2");
  });

  it("returns the input unchanged when it isn't a parseable http(s) URL", () => {
    expect(canonicalizeUrl("not a url")).toBe("not a url");
    expect(canonicalizeUrl("")).toBeNull();
  });
});

describe("stableExternalId", () => {
  // The same Indeed vacancy, crawled three times on 29 Sep 2026: jk constant, bb/xkcb rotating.
  const crawls = [
    "https://ie.indeed.com/rc/clk?jk=bf4164d05911192e&bb=E8jRG66z&xkcb=SoCE67M2&fccid=b07d10a9&vjs=3",
    "https://ie.indeed.com/rc/clk?jk=bf4164d05911192e&bb=LTiz2OFf&xkcb=SoAU67M2&fccid=b07d10a9&vjs=3",
    "https://ie.indeed.com/rc/clk?jk=bf4164d05911192e&bb=XGph83r1&xkcb=SoBJ67M2&fccid=b07d10a9&vjs=3",
  ];

  it("gives a re-crawled link-shaped id the same identity every time", () => {
    const ids = new Set(crawls.map(stableExternalId));
    expect([...ids]).toEqual(["https://ie.indeed.com/viewjob?jk=bf4164d05911192e"]);
    const keys = new Set(
      crawls.map((id) =>
        canonicalOccurrenceJobKey(
          "Indeed",
          "IT Graduate Programme",
          "Dublin",
          "fadi-scraper:indeed",
          id
        )
      )
    );
    expect(keys.size).toBe(1);
  });

  it("keeps two different vacancies apart", () => {
    expect(stableExternalId("https://ie.indeed.com/rc/clk?jk=aaa&bb=1")).not.toBe(
      stableExternalId("https://ie.indeed.com/rc/clk?jk=bbb&bb=1")
    );
  });

  it("leaves an ordinary provider id alone", () => {
    expect(stableExternalId(" Req-A ")).toBe("Req-A");
  });
});
