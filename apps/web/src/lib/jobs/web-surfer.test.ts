import { describe, expect, it } from "vitest";

import {
  detectAts,
  extractJsonLdJobs,
  htmlToText,
  looksBlocked,
  mapGreenhouse,
  mapLever,
} from "./web-surfer";

describe("detectAts", () => {
  it("recognises Greenhouse board URLs", () => {
    expect(detectAts("https://boards.greenhouse.io/gitlab")).toEqual({ kind: "greenhouse", token: "gitlab" });
    expect(detectAts("job-boards.greenhouse.io/stripe/jobs/123")).toEqual({ kind: "greenhouse", token: "stripe" });
    expect(detectAts("https://boards-api.greenhouse.io/v1/boards/gitlab/jobs")).toEqual({
      kind: "greenhouse",
      token: "gitlab",
    });
  });

  it("recognises Lever board URLs", () => {
    expect(detectAts("https://jobs.lever.co/netflix")).toEqual({ kind: "lever", token: "netflix" });
    expect(detectAts("api.lever.co/v0/postings/leverdemo?mode=json")).toEqual({ kind: "lever", token: "leverdemo" });
  });

  it("accepts shorthand", () => {
    expect(detectAts("greenhouse:gitlab")).toEqual({ kind: "greenhouse", token: "gitlab" });
    expect(detectAts("lever/netflix")).toEqual({ kind: "lever", token: "netflix" });
  });

  it("returns null for a generic career page", () => {
    expect(detectAts("https://example.com/careers")).toBeNull();
    expect(detectAts("not a url")).toBeNull();
  });
});

describe("ATS mappers", () => {
  it("maps Greenhouse jobs, dropping title-less rows", () => {
    const jobs = mapGreenhouse(
      {
        jobs: [
          { title: "AI Engineer", location: { name: "Remote, Bangalore" }, absolute_url: "https://x/1" },
          { title: "", location: { name: "Nowhere" } },
        ],
      },
      "gitlab",
    );
    expect(jobs).toEqual([
      { title: "AI Engineer", company: "gitlab", location: "Remote, Bangalore", url: "https://x/1", description: undefined },
    ]);
  });

  it("maps Lever postings", () => {
    const jobs = mapLever(
      [{ text: "SRE", categories: { location: "Dublin", team: "Infra" }, hostedUrl: "https://l/2", descriptionPlain: "Run things." }],
      "acme",
    );
    expect(jobs[0]).toMatchObject({ title: "SRE", company: "acme", location: "Dublin", url: "https://l/2" });
  });

  it("survives malformed ATS payloads", () => {
    expect(mapGreenhouse(null)).toEqual([]);
    expect(mapLever(null)).toEqual([]);
  });
});

describe("extractJsonLdJobs", () => {
  it("pulls a JobPosting out of a ld+json script block", () => {
    const html = `<html><head>
      <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: "Cloud Operations Engineer",
        hiringOrganization: { name: "Laserfiche" },
        jobLocation: { address: { addressLocality: "Dublin", addressCountry: "Ireland" } },
        url: "https://co/job/1",
        description: "<p>Monitor the cloud.</p>",
      })}</script></head><body></body></html>`;
    expect(extractJsonLdJobs(html)).toEqual([
      {
        title: "Cloud Operations Engineer",
        company: "Laserfiche",
        location: "Dublin, Ireland",
        url: "https://co/job/1",
        description: "Monitor the cloud.",
      },
    ]);
  });

  it("walks @graph and dedupes", () => {
    const node = { "@type": "JobPosting", title: "Dev", hiringOrganization: "Acme" };
    const html = `<script type="application/ld+json">${JSON.stringify({ "@graph": [node, node] })}</script>`;
    expect(extractJsonLdJobs(html)).toHaveLength(1);
  });

  it("ignores non-job and malformed blocks", () => {
    const html = `<script type="application/ld+json">{"@type":"WebSite","name":"x"}</script>
      <script type="application/ld+json">not json</script>`;
    expect(extractJsonLdJobs(html)).toEqual([]);
  });
});

describe("looksBlocked", () => {
  it("flags challenge statuses and bodies", () => {
    expect(looksBlocked(403, "")).toBe(true);
    expect(looksBlocked(200, "<title>Just a moment...</title>")).toBe(true);
    expect(looksBlocked(200, "please enable javascript to view this page")).toBe(true);
  });
  it("passes real content", () => {
    expect(looksBlocked(200, "<html><body>Jobs at Acme</body></html>")).toBe(false);
  });
});

describe("htmlToText", () => {
  it("strips scripts, tags, and entities", () => {
    expect(htmlToText("<script>x</script><p>Hi&amp;bye</p>")).toBe("Hi&bye");
  });
});
