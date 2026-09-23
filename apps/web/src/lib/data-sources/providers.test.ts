import { describe, expect, it, vi } from "vitest";

import { BlsSource, snapshotToSignal } from "./providers/bls";
import { LightcastSkillsSource, skillsToSignal } from "./providers/lightcast";

describe("BLS labor provider", () => {
  it("is keyless (always configured) and labor-market capable", () => {
    const s = new BlsSource();
    expect(s.isConfigured).toBe(true);
    expect(s.capabilities).toContain("labor_market");
  });

  it("turns a labor snapshot into a ranked labor signal", () => {
    const signal = snapshotToSignal(
      { summary: "US labor market: unemployment 4.1% and steady.", asOf: "May 2026" },
      ["frontend", "react", "typescript"],
    );
    expect(signal).toMatchObject({
      sourceId: "bls",
      kind: "labor",
      regions: ["US", "United States"],
    });
    // The BLS period label is normalized to an ISO date for `publishedAt`.
    expect(signal?.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(new Date(signal!.publishedAt!).getUTCFullYear()).toBe(2026);
    // User terms ride along so the macro signal clears the relevance threshold.
    expect(signal?.skills).toEqual(["frontend", "react", "typescript"]);
  });

  it("emits nothing when there's no snapshot summary", () => {
    expect(snapshotToSignal({ summary: "", asOf: null }, ["x"])).toBeNull();
  });
});

describe("Lightcast Open Skills provider", () => {
  it("self-disables without both credentials", () => {
    expect(new LightcastSkillsSource().isConfigured).toBe(false);
    expect(new LightcastSkillsSource("id").isConfigured).toBe(false);
    expect(new LightcastSkillsSource("id", "secret").isConfigured).toBe(true);
  });

  it("builds a deduped, normalized skill_trend signal", () => {
    const signal = skillsToSignal(["React", " React ", "TypeScript", ""], ["frontend"]);
    expect(signal).toMatchObject({ sourceId: "lightcast", kind: "skill_trend" });
    expect(signal?.skills).toEqual(["React", "TypeScript"]);
    expect(signal?.title).toContain("frontend");
  });

  it("emits nothing when no skills were found", () => {
    expect(skillsToSignal([], ["frontend"])).toBeNull();
  });
});

/**
 * A DEEP RUN MUST ACTUALLY ASK FOR DEPTH.
 *
 * The background crawl asks discoverJobs for 200 postings, and each board caps that at whatever
 * one page of its API will give — Reed 100, Jooble 50. Nothing in the code stops someone
 * "tidying" that limit back to the default 20, and the board would simply get thinner with no
 * test failing and no error anywhere. These pin the page size each board is asked for.
 */
describe("the boards are asked for a full page, not a default handful", () => {
  const asked = (url: string, param: string) => Number(new URL(url).searchParams.get(param));

  it("Reed asks for its maximum page", async () => {
    const { ReedSource } = await import("./providers/reed");
    const calls: string[] = [];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    });
    try {
      await new ReedSource("key").fetchJobs({
        keywords: ["it support"],
        country: "gb",
        limit: 200,
      } as never);
    } finally {
      fetchSpy.mockRestore();
    }
    expect(calls).toHaveLength(1);
    expect(asked(calls[0], "resultsToTake")).toBe(100);
  });
});

/**
 * The registry is a product decision, so it is tested like one. Eleven job sources produced 567
 * postings this person could act on; five of them produced 533. Adding one back without first
 * measuring what it returns FOR THE MARKET IT WILL BE ASKED ABOUT is the defect this pins.
 */
describe("the source registry", () => {
  it("carries only the job sources that earn their place", async () => {
    const { listSourceStatus } = await import("./registry");
    const ids = listSourceStatus().map((source) => source.id);

    for (const kept of ["web-surfer", "web-crawl", "jooble", "reed"]) {
      expect(ids, `${kept} should be registered`).toContain(kept);
    }
    for (const dropped of [
      "adzuna",
      "jsearch",
      "arbeitnow",
      "remotive",
      "themuse",
      "apify_linkedin",
      "linkedin-guest",
      "indeed-public",
    ]) {
      expect(ids, `${dropped} was retired — see docs/FADI_AGENT_DESIGN.md`).not.toContain(dropped);
    }
  });
});
