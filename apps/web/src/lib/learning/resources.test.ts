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

  it("RESOLVED (was a pinned ambiguity): a service-desk analyst now routes to devops", () => {
    // This used to assert data-analyst, pinned with a comment calling it "plausibly
    // wrong": the bare `analyst` rule outranked the support→devops rule. Requiring
    // discriminative tokens ("data analyst", not bare "analyst") fixes it as a side
    // effect — the IT service-desk role now gets the IT roadmap, and a genuine data
    // analyst still matches on "data analyst".
    expect(learningResources("Service Desk Analyst").roadmap).toBe("https://roadmap.sh/devops");
    expect(learningResources("Data Analyst").roadmap).toBe("https://roadmap.sh/data-analyst");
  });

  it("offers NO roadmap for a skill outside software — an absent link beats a wrong one", () => {
    // roadmap.sh is entirely software. Sending a nurse, a site engineer or a teacher
    // there told them the tool was not built for them; the old fallback did exactly that.
    expect(learningResources("underwater basket weaving").roadmap).toBeNull();
    expect(learningResources("Venepuncture").roadmap).toBeNull();
    expect(learningResources("Structural steel design").roadmap).toBeNull();
    expect(learningResources("Phonics instruction").roadmap).toBeNull();
  });

  it("phrases practice the way the field actually practises", () => {
    // Software builds things; clinical, teaching and legal skills are practised
    // through worked examples. "Build a venepuncture project" is nonsense.
    expect(learningResources("Kubernetes").practice).toContain(
      encodeURIComponent("build a Kubernetes project"),
    );
    expect(learningResources("Venepuncture").practice).toContain(
      encodeURIComponent("Venepuncture practice exercises worked examples"),
    );
  });

  it("still serves the field-neutral links for any career", () => {
    for (const skill of ["Venepuncture", "Structural steel design", "Safeguarding"]) {
      const l = learningResources(skill);
      expect(l.youtube).toMatch(/^https:\/\//);
      expect(l.courses).toMatch(/^https:\/\//);
      expect(l.practice).toMatch(/^https:\/\//);
    }
  });

  it("URL-encodes the skill into the search links", () => {
    // Uses a skill that genuinely matches software, so the "build a project" phrasing
    // is exercised alongside the encoding.
    const links = learningResources("C++ & Docker");
    expect(links.youtube).toContain(encodeURIComponent("C++ & Docker full course tutorial"));
    expect(links.courses).toContain(encodeURIComponent("C++ & Docker"));
    expect(links.practice).toContain(encodeURIComponent("build a C++ & Docker project"));
    // Never emit a raw space or ampersand that would break the URL.
    expect(links.courses).not.toMatch(/[ &]/);
  });

  it("always returns the four resource keys; only roadmap may be null", () => {
    const links = learningResources("anything");
    expect(Object.keys(links).sort()).toEqual(["courses", "practice", "roadmap", "youtube"]);
    for (const [key, url] of Object.entries(links)) {
      if (key === "roadmap" && url === null) continue;
      expect(url).toMatch(/^https:\/\//);
    }
  });
});
