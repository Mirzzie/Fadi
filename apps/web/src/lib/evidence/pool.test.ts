import { describe, expect, it } from "vitest";

import {
  evidenceRelevance,
  formatTopEvidence,
  normKind,
  rankEvidenceForTrack,
  type EvidenceView,
} from "./pool";

const item = (over: Partial<EvidenceView>): EvidenceView => ({
  id: Math.random().toString(36).slice(2),
  kind: "experience",
  title: "Untitled",
  organization: null,
  period: null,
  detail: "",
  metrics: null,
  tags: [],
  marketTags: [],
  origin: "manual",
  ...over,
});

const nursing = item({
  title: "Staff Nurse",
  organization: "St. Mary's Hospital",
  detail: "Ran a 30-bed ward, led patient care and triage.",
  tags: ["patient care", "triage", "clinical"],
});
const coding = item({
  title: "Built a scheduling app",
  detail: "Wrote a Python and React app to manage rota shifts.",
  tags: ["python", "react", "software"],
});

describe("normKind", () => {
  it("normalizes to a known kind, defaulting to experience", () => {
    expect(normKind("project")).toBe("project");
    expect(normKind("WEIRD")).toBe("experience");
  });
});

describe("evidenceRelevance — the same item is weighted differently per track", () => {
  it("nursing evidence scores high for a nursing track, ~0 for software", () => {
    const forNurse = evidenceRelevance(nursing, { role: "Registered Nurse", domain: "Healthcare", synonyms: ["staff nurse", "clinical nurse"] });
    const forDev = evidenceRelevance(nursing, { role: "Software Engineer", domain: "Technology", synonyms: ["developer"] });
    expect(forNurse.score).toBeGreaterThan(forDev.score);
    expect(forNurse.matched).toEqual(expect.arrayContaining(["nurse"]));
    expect(forDev.score).toBe(0); // nothing in the nursing item overlaps a software track
  });

  it("the coding project scores high for software, low for nursing", () => {
    const forDev = evidenceRelevance(coding, { role: "Software Engineer", domain: "Technology" });
    const forNurse = evidenceRelevance(coding, { role: "Registered Nurse", domain: "Healthcare" });
    expect(forDev.score).toBeGreaterThan(forNurse.score);
    expect(forDev.matched).toEqual(expect.arrayContaining(["software"]));
  });

  it("scores 0 when the track has no terms", () => {
    expect(evidenceRelevance(nursing, { role: "" }).score).toBe(0);
  });
});

/** The doctrine's flagship example: real proof, described only in the user's own words. */
const untranslatedHomelab = item({
  kind: "project",
  title: "Home SOC lab",
  period: "2025",
  detail: "Ran Wazuh and Suricata on Proxmox; triaged ~200 simulated attacks.",
  metrics: "200 alerts triaged",
  tags: ["wazuh", "suricata", "proxmox", "homelab"],
});

describe("marketTags — the stored translation layer", () => {
  it("is what lets real-but-untranslated proof reach a market-named track", () => {
    const track = { role: "Cybersecurity Analyst", domain: "Cybersecurity" };

    // The user's own vocabulary shares no token with the role: invisible.
    expect(evidenceRelevance(untranslatedHomelab, track).score).toBe(0);

    // Naming the SAME real work the way postings name it makes it visible. Nothing
    // about the evidence changed — only what we call it.
    const translated = item({
      ...untranslatedHomelab,
      marketTags: ["siem", "incident triage", "security monitoring", "log analysis"],
    });
    const { score, matched } = evidenceRelevance(translated, track);
    expect(score).toBeGreaterThan(0);
    expect(matched).toEqual(expect.arrayContaining(["security monitoring"]));
  });

  it("weighs the market's name above the user's own words for a market-named track", () => {
    const own = item({ title: "A", tags: ["cybersecurity"] });
    const market = item({ title: "B", marketTags: ["cybersecurity"] });
    const track = { role: "Cybersecurity Analyst" };
    expect(evidenceRelevance(market, track).score).toBeGreaterThan(
      evidenceRelevance(own, track).score,
    );
  });

  it("ranks translated proof above an untranslated near-duplicate", () => {
    const translated = item({
      ...untranslatedHomelab,
      title: "Home SOC lab (translated)",
      marketTags: ["siem", "incident triage"],
    });
    const ranked = rankEvidenceForTrack([untranslatedHomelab, translated], {
      role: "SIEM Analyst",
    });
    expect(ranked[0].item.title).toBe("Home SOC lab (translated)");
    expect(ranked).toHaveLength(2); // and the untranslated one is still not deleted
  });
});

describe("formatTopEvidence — the pool→prompt bridge", () => {
  it("returns an empty string ONLY when the pool itself is empty", () => {
    expect(formatTopEvidence([])).toBe("");
  });

  it("NEVER drops real evidence just because it doesn't match the track's words", () => {
    // The regression this pins: a home lab tagged wazuh/suricata/proxmox shares no
    // tokens with "Cybersecurity Analyst", so a score>0 filter deleted the single
    // best proof a thin-experience candidate has. Low score = UNTRANSLATED, which is
    // the thing this product exists to fix — not a reason to hide it from the model.
    const ranked = rankEvidenceForTrack([untranslatedHomelab], {
      role: "Cybersecurity Analyst",
      domain: "Cybersecurity",
    });

    expect(ranked[0].score).toBe(0); // still no lexical overlap — that's expected
    const block = formatTopEvidence(ranked);
    expect(block).toContain("Home SOC lab"); // ...but it MUST still reach the prompt
    expect(block).toContain("200 alerts triaged");
    // And it must be labelled honestly rather than claimed as a role match.
    expect(block).toMatch(/UNTRANSLATED/);
    expect(block).toMatch(/never invent/i);
  });

  it("leads with the best match but keeps weaker evidence behind it", () => {
    const ranked = rankEvidenceForTrack([nursing, coding], { role: "Registered Nurse", domain: "Healthcare", synonyms: ["staff nurse"] });
    const block = formatTopEvidence(ranked);
    expect(block).toMatch(/MOST RELEVANT EVIDENCE/);
    expect(block).toMatch(/never invent/i);
    // Order carries the relevance signal...
    expect(block.indexOf("Staff Nurse")).toBeLessThan(block.indexOf("scheduling app"));
    // ...but the un-matched item is still available to the model, not deleted.
    expect(block).toContain("scheduling app");
  });

  it("truncates large pools by rank, so the best evidence survives the cut", () => {
    const many: EvidenceView[] = Array.from({ length: 12 }, (_, i) => ({
      ...coding,
      id: `c${i}`,
      title: `Filler ${i}`,
      tags: [],
    }));
    const ranked = rankEvidenceForTrack([...many, nursing], { role: "Registered Nurse", synonyms: ["staff nurse"] });
    const block = formatTopEvidence(ranked, 3);
    expect(block).toContain("Staff Nurse"); // the match survives truncation
    expect(block.split("\n").length - 1).toBe(3); // header + exactly 3 items
  });
});

describe("rankEvidenceForTrack — one pool, framed per track", () => {
  const pool = [nursing, coding];

  it("ranks the nursing item first for a nursing track and the coding item first for software", () => {
    const asNurse = rankEvidenceForTrack(pool, { role: "Registered Nurse", domain: "Healthcare", synonyms: ["staff nurse"] });
    const asDev = rankEvidenceForTrack(pool, { role: "Software Engineer", domain: "Technology" });
    expect(asNurse[0].item.title).toBe("Staff Nurse");
    expect(asDev[0].item.title).toBe("Built a scheduling app");
    // Everything stays in the pool either way — nothing is deleted, just re-ranked.
    expect(asNurse).toHaveLength(2);
    expect(asDev).toHaveLength(2);
  });
});
