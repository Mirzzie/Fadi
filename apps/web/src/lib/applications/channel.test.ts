import { describe, expect, it } from "vitest";

import { analyseChannelMix, channelInsight, channelUrl, detectChannel } from "./channel";

describe("detectChannel", () => {
  it("fingerprints the big vendors from a real application URL", () => {
    expect(detectChannel("https://acme.wd1.myworkdayjobs.com/en-US/careers/job/123")).toBe(
      "workday",
    );
    expect(detectChannel("https://boards.greenhouse.io/acme/jobs/4567")).toBe("greenhouse");
    expect(detectChannel("https://jobs.lever.co/acme/abc-123")).toBe("lever");
    expect(detectChannel("https://jobs.ashbyhq.com/acme/xyz")).toBe("ashby");
    expect(detectChannel("https://careers.icims.com/jobs/999")).toBe("icims");
    expect(detectChannel("https://acme.taleo.net/careersection/jobdetail.ftl")).toBe("taleo");
  });

  it("treats an unrecognised real URL as the company's own site, not 'unknown'", () => {
    // This distinction matters: a direct careers page is OUTSIDE the vendor
    // monoculture, so it must never be lumped in with un-attributable rows.
    expect(detectChannel("https://careers.some-company.ie/roles/soc-analyst")).toBe("other");
  });

  it("returns unknown only when there is genuinely no URL", () => {
    expect(detectChannel(null)).toBe("unknown");
    expect(detectChannel(undefined)).toBe("unknown");
    expect(detectChannel("   ")).toBe("unknown");
  });
});

describe("analyseChannelMix", () => {
  it("counts effective draws as DISTINCT channels, not applications", () => {
    // The core of the monoculture thesis: 4 Workday applications are one draw.
    const mix = analyseChannelMix([
      { url: "https://a.myworkdayjobs.com/x" },
      { url: "https://b.myworkdayjobs.com/y" },
      { url: "https://c.myworkdayjobs.com/z" },
      { url: "https://boards.greenhouse.io/a/1" },
    ]);
    expect(mix.total).toBe(4);
    expect(mix.effectiveDraws).toBe(2); // NOT 4
    expect(mix.dominant).toMatchObject({ channel: "workday", count: 3 });
  });

  it("excludes un-attributable rows rather than guessing", () => {
    const mix = analyseChannelMix([{ url: null }, { url: "https://boards.greenhouse.io/a/1" }]);
    expect(mix.total).toBe(1);
    expect(mix.counts.unknown).toBeUndefined();
  });

  it("flags concentration only past the evidence threshold", () => {
    const workday = (n: number) => Array.from({ length: n }, () => ({ url: "https://x.myworkdayjobs.com/a" }));
    expect(analyseChannelMix(workday(4)).concentrated).toBe(false); // too little evidence
    expect(analyseChannelMix(workday(5)).concentrated).toBe(true);
  });

  it("does not flag a genuinely diversified pipeline", () => {
    const mix = analyseChannelMix([
      { url: "https://a.myworkdayjobs.com/1" },
      { url: "https://boards.greenhouse.io/a/2" },
      { url: "https://jobs.lever.co/a/3" },
      { url: "https://jobs.ashbyhq.com/a/4" },
      { url: "https://careers.company.ie/5" },
    ]);
    expect(mix.effectiveDraws).toBe(5);
    expect(mix.concentrated).toBe(false);
  });

  it("survives an empty pipeline", () => {
    const mix = analyseChannelMix([]);
    expect(mix).toMatchObject({ total: 0, effectiveDraws: 0, concentrated: false, dominant: null });
  });

  it("attributes off the LINKED JOB url when the application has none", () => {
    // The bug that kept decorrelation permanently silent: the application's own url is
    // null on the primary creation path, but the linked discovered job carries the URL.
    // Five concentrated Workday jobs must now fire even though every app.url is null.
    const mix = analyseChannelMix(
      Array.from({ length: 5 }, () => ({ url: null, jobUrl: "https://x.myworkdayjobs.com/a" })),
    );
    expect(mix.total).toBe(5);
    expect(mix.concentrated).toBe(true);
    expect(mix.dominant).toMatchObject({ channel: "workday", count: 5 });
  });

  it("prefers the application's own url over the linked job's", () => {
    // If the user pasted the exact posting they applied through, that beats the
    // discovered job's url — they may have applied via a different channel than found.
    const mix = analyseChannelMix([
      { url: "https://boards.greenhouse.io/a/1", jobUrl: "https://x.myworkdayjobs.com/a" },
    ]);
    expect(mix.dominant).toMatchObject({ channel: "greenhouse", count: 1 });
  });
});

describe("channelUrl — attribution precedence", () => {
  it("prefers app url, falls back to job url, then null", () => {
    expect(channelUrl("https://app", "https://job")).toBe("https://app");
    expect(channelUrl(null, "https://job")).toBe("https://job");
    expect(channelUrl("  ", "https://job")).toBe("https://job"); // blank app url isn't a signal
    expect(channelUrl(null, null)).toBeNull();
  });
});

describe("channelInsight — the honesty rules", () => {
  it("stays SILENT when there isn't enough evidence to claim a pattern", () => {
    // n=3 is not evidence. Manufacturing advice here would be exactly the
    // unsourced folklore this platform exists to refuse.
    const mix = analyseChannelMix([
      { url: "https://a.myworkdayjobs.com/1" },
      { url: "https://a.myworkdayjobs.com/2" },
      { url: "https://a.myworkdayjobs.com/3" },
    ]);
    expect(channelInsight(mix)).toBeNull();
  });

  it("stays SILENT when the mix is already diversified (nothing to fix)", () => {
    const mix = analyseChannelMix([
      { url: "https://a.myworkdayjobs.com/1" },
      { url: "https://boards.greenhouse.io/a/2" },
      { url: "https://jobs.lever.co/a/3" },
      { url: "https://jobs.ashbyhq.com/a/4" },
      { url: "https://careers.company.ie/5" },
    ]);
    expect(channelInsight(mix)).toBeNull();
  });

  it("reframes a concentrated streak as ONE repeated verdict, and gives an action", () => {
    const mix = analyseChannelMix(
      Array.from({ length: 12 }, () => ({ url: "https://x.myworkdayjobs.com/a" })),
    );
    const insight = channelInsight(mix);

    expect(insight).not.toBeNull();
    // The claim that protects the user's locus of control must actually be made.
    expect(insight!.headline).toContain("Workday");
    expect(insight!.headline).toMatch(/1 rejection repeated 12 times/);
    // Principle 5: a signal that doesn't resolve into an action is just anxiety.
    expect(insight!.action).toMatch(/different|referral/i);
  });
});
