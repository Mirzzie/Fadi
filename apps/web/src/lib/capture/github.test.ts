import { describe, expect, it } from "vitest";

import { repoToCandidate, worthCapturing } from "./github";

/**
 * Capture must be incapable of inflating a record. Everything it produces has to trace
 * back to something GitHub actually returned — that is the entire reason a repository
 * is worth more than a sentence the user wrote about themselves.
 */
const repo = (over: Partial<Parameters<typeof repoToCandidate>[0]> = {}) => ({
  name: "openclaw-home-soc",
  description: "Wazuh and Suricata on Proxmox VE.",
  language: "Shell",
  topics: ["security", "homelab"],
  url: "https://github.com/Mirzzie/openclaw-home-soc",
  createdAt: "2025-02-11T10:00:00Z",
  pushedAt: "2026-08-02T10:00:00Z",
  ...over,
});

describe("a repository as evidence", () => {
  it("keeps the link, because the link is what makes it proof", () => {
    expect(repoToCandidate(repo()).url).toBe("https://github.com/Mirzzie/openclaw-home-soc");
  });

  it("uses the repo's own name, never a prettified guess", () => {
    // Inventing "OpenClaw Home SOC" would be a nicer title and a fabrication.
    expect(repoToCandidate(repo()).title).toBe("openclaw-home-soc");
  });

  it("dates it from real timestamps, as a range when the work spanned years", () => {
    expect(repoToCandidate(repo()).period).toBe("2025 – 2026");
  });

  it("collapses a single-year project to one year rather than '2026 – 2026'", () => {
    expect(repoToCandidate(repo({ createdAt: "2026-01-05T00:00:00Z" })).period).toBe("2026");
  });

  it("survives a repo with no dates at all", () => {
    expect(repoToCandidate(repo({ createdAt: null, pushedAt: null })).period).toBeNull();
  });

  it("carries language and topics as tags, lowercased for the resolver", () => {
    expect(repoToCandidate(repo()).tags).toEqual(["shell", "security", "homelab"]);
  });

  it("never invents a description", () => {
    // An empty description stays empty. The integrity panel can then say the project
    // needs one; a generated blurb would hide that it was never written.
    expect(repoToCandidate(repo({ description: null })).detail).toBeNull();
    expect(repoToCandidate(repo({ description: "   " })).detail).toBeNull();
  });

  it("is machine-authored, so it can never displace the user's own wording", () => {
    // The two-way rule keys on origin: extraction and capture propose, they do not
    // overwrite. A repo description must not replace a project blurb the user wrote.
    expect(repoToCandidate(repo()).origin).toBe("github");
  });
});

describe("what counts as work", () => {
  const r = (over: Record<string, unknown> = {}) => ({
    name: "ansible-nci", fork: false, archived: false,
    description: null as string | null, language: "Shell", topics: [] as string[],
    pushedAt: "2026-01-01T00:00:00Z", ...over,
  });
  const NOW = Date.parse("2026-09-10T00:00:00Z");

  it("MEASURED ON THE REAL ACCOUNT: drops the tutorial clones", () => {
    // 24 of 47 repos passed the first filter. These were among them.
    for (const name of [
      "skills-communicate-using-markdown",
      "skills-getting-started-with-github-copilot",
      "odin-recipes",
      "Hello-Github",
      "Sample-Pygame",
    ]) {
      expect(worthCapturing(r({ name }), NOW)).toBe(false);
    }
  });

  it("drops a repo whose own description says it is an exercise", () => {
    expect(worthCapturing(r({ name: "some-repo", description: "Exercise: get started" }), NOW)).toBe(false);
    expect(worthCapturing(r({ name: "some-repo", description: "My clone repository" }), NOW)).toBe(false);
  });

  it("keeps described work however old it is", () => {
    const old = r({ name: "wordpress", description: "WORDPRESS WEBSITE PORTAL", pushedAt: "2023-01-01T00:00:00Z" });
    expect(worthCapturing(old, NOW)).toBe(true);
  });

  it("keeps recent undescribed work — 19 of the user's repos have no description", () => {
    // Losing all of them would leave the dissertation and the Terraform work out.
    expect(worthCapturing(r({ name: "x23209291-DevSecOps-RASP", pushedAt: "2025-06-01T00:00:00Z" }), NOW)).toBe(true);
  });

  it("drops undescribed work old enough to say nothing about you now", () => {
    expect(worthCapturing(r({ name: "Digi-Clock", language: "C", pushedAt: "2021-05-01T00:00:00Z" }), NOW)).toBe(false);
  });

  it("never claims a fork or an archived repo", () => {
    expect(worthCapturing(r({ fork: true, description: "Real description" }), NOW)).toBe(false);
    expect(worthCapturing(r({ archived: true, description: "Real description" }), NOW)).toBe(false);
  });
});
