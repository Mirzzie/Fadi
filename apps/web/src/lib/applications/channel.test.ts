import { describe, expect, it } from "vitest";

import { analyseChannelMix, channelInsight, detectChannel } from "./channel";

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
