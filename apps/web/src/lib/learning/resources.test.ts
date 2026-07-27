import { describe, expect, it } from "vitest";

import { learningResources } from "./resources";

/**
 * `learningResources` maps a free-text skill to real learning URLs via an ordered regex
 * table (first match wins). Untested, and the ordering is load-bearing: a rule moved or
 * a slug typo silently sends users to the wrong roadmap or the generic index. Pure, so
 * pinning it is free.
 */
describe("learningResources", () => {
  it("maps common tech skills to their roadmap.sh slug", () => {
    expect(learningResources("Kubernetes").roadmap).toBe("https://roadmap.sh/devops");
    expect(learningResources("React").roadmap).toBe("https://roadmap.sh/frontend");
    expect(learningResources("Python").roadmap).toBe("https://roadmap.sh/python");
    expect(learningResources("SOC analyst").roadmap).toBe("https://roadmap.sh/cyber-security");
  });

  it("maps NON-tech support/ops vocabulary to a real roadmap, not the fallback", () => {
    // The platform is domain-agnostic: a helpdesk/service-desk user must still get a
    // concrete path. This is the row most likely to be dropped as "not a dev skill".
    expect(learningResources("Helpdesk Technician").roadmap).toBe("https://roadmap.sh/devops");
    expect(learningResources("IT support").roadmap).toBe("https://roadmap.sh/devops");
    expect(learningResources("Service Management").roadmap).toBe("https://roadmap.sh/devops");
  });

  it("KNOWN AMBIGUITY: 'analyst' wins over 'support', so a service-desk analyst gets data-analyst", () => {
    // Pinning current behaviour, NOT endorsing it. The `analyst` rule precedes the
    // support→devops rule, so "Service Desk Analyst" routes to the data-analytics
    // roadmap — plausibly wrong for an IT service-desk role. Left as-is deliberately:
    // reordering to fix this would misroute genuine data analysts, and which matters
    // more is a product call, not a bug fix. This test exists so the tradeoff is
    // visible and any future reorder is a conscious change, not an accident.
    expect(learningResources("Service Desk Analyst").roadmap).toBe(
      "https://roadmap.sh/data-analyst",
    );
  });

  it("falls back to the roadmap index for an unrecognised skill", () => {
    expect(learningResources("underwater basket weaving").roadmap).toBe(
      "https://roadmap.sh/roadmaps",
    );
  });

  it("URL-encodes the skill into the search links", () => {
    const links = learningResources("C++ & data");
    expect(links.youtube).toContain(encodeURIComponent("C++ & data full course tutorial"));
    expect(links.courses).toContain(encodeURIComponent("C++ & data"));
    expect(links.project).toContain(encodeURIComponent("build a C++ & data project"));
    // Never emit a raw space or ampersand that would break the URL.
    expect(links.courses).not.toMatch(/[ &]/);
  });

  it("always returns all four resource links", () => {
    const links = learningResources("anything");
    expect(Object.keys(links).sort()).toEqual(["courses", "project", "roadmap", "youtube"]);
    for (const url of Object.values(links)) expect(url).toMatch(/^https:\/\//);
  });
});
