import { describe, expect, it } from "vitest";

import { speakable } from "./speakable";

describe("saying something written for the eye", () => {
  /** What the person actually heard: a table of four jobs, read as punctuation. */
  it("reads a table as its cells, not its pipes", () => {
    const said = speakable(
      "| Role | Source | Key match |\n|------|--------|-----------|\n| **IT Support Engineer** | Indeed | support |\n| **Desktop Support Engineer** | Indeed | desktop |"
    );

    expect(said).not.toContain("|");
    expect(said).not.toContain("---");
    expect(said).toContain("IT Support Engineer, Indeed, support");
    expect(said).toContain("Desktop Support Engineer");
  });

  it("drops the marks that are seen and not said", () => {
    const said = speakable("## What to do next\n- **Pick** a posting\n- Tweak your `résumé`\n> then apply");
    expect(said).not.toMatch(/[#*`>]/);
    expect(said).toContain("What to do next");
    expect(said).toContain("Pick a posting");
  });

  it("keeps a link's words and loses its address", () => {
    const said = speakable("See [the posting](https://example.test/jobs/1) for details");
    expect(said).toContain("the posting");
    expect(said).not.toContain("http");
  });

  it("stops at a sentence rather than mid-fact, and says there is more", () => {
    const long = Array.from({ length: 40 }, (_, i) => `This is sentence number ${i}.`).join(" ");
    const said = speakable(long, 200);

    expect(said.length).toBeLessThan(320);
    expect(said).toContain("There's more");
    expect(said).not.toMatch(/number \d+$/);
  });

  it("leaves a plain answer alone", () => {
    expect(speakable("Still open: Contract IS Technical Support Analyst at Deerfoot.")).toBe(
      "Still open: Contract IS Technical Support Analyst at Deerfoot."
    );
  });
});
