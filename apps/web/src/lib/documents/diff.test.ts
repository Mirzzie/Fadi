import { describe, expect, it } from "vitest";

import { diffDocuments, speakableDiff } from "./diff";

describe("showing what a rewrite touched", () => {
  it("leaves untouched lines alone", () => {
    const before = "Summary\nBuilt a lab\nSupported users";
    const diff = diffDocuments(before, before);

    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(0);
    expect(diff.summary).toBe("Nothing changed.");
    expect(diff.rows.every((row) => row.kind === "same")).toBe(true);
  });

  it("marks one replaced bullet without touching its neighbours", () => {
    const diff = diffDocuments(
      "Summary\n- Ran the service desk\n- Built a lab",
      "Summary\n- Ran the service desk for 200 staff\n- Built a lab"
    );

    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(1);
    expect(diff.rows.filter((row) => row.kind === "same")).toHaveLength(2);
    expect(diff.summary).toContain("Rewrote 1 line");
  });

  it("says when it cut, and when it grew", () => {
    expect(diffDocuments("a\nb\nc", "a").summary).toContain("took out 2 lines");
    expect(diffDocuments("a", "a\nb").summary).toContain("added 1 line");
    expect(diffDocuments("a long line about everything", "short").summary).toContain("shorter");
  });

  /** Said aloud, this is all someone has to decide on. It must be short and specific. */
  it("reads back the changes, capped", () => {
    const diff = diffDocuments("a\nb\nc\nd", "a\nB\nC\nD");
    const spoken = speakableDiff(diff, 2);

    expect(spoken).toContain("Now reads: B");
    expect(spoken).toMatch(/more changes/);
    expect(spoken.length).toBeLessThan(400);
  });
});

describe("comparing a document that is stored as JSON", () => {
  const resume = (summary: string, bullet: string) =>
    JSON.stringify({
      personal: { name: "Mirzad Ismail", headline: "Support Analyst" },
      summary,
      experiences: [{ id: "abc", company: "Spark", title: "Consultant", bullets: bullet }],
    });

  /** The defect: one line of JSON diffed as one line, and showed a wall of braces. */
  it("compares what a person reads, not the braces", () => {
    const diff = diffDocuments(
      resume("IT support professional with proven ability.", "Handled tickets"),
      resume("IT support professional.", "Handled tickets")
    );

    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(1);
    expect(diff.rows.some((row) => row.text.includes("{"))).toBe(false);
    expect(diff.rows.find((row) => row.kind === "added")!.text).toBe(
      "summary: IT support professional."
    );
    // Everything else is untouched and says so.
    expect(diff.rows.filter((row) => row.kind === "same").length).toBeGreaterThan(2);
  });

  it("names the field that changed when read aloud", () => {
    const spoken = speakableDiff(
      diffDocuments(
        resume("Old summary.", "Handled tickets"),
        resume("Old summary.", "Ran the service desk for 200 staff")
      )
    );
    expect(spoken).toContain("bullets");
    expect(spoken).toContain("Ran the service desk for 200 staff");
  });

  it("ignores ids, which no one reads and every rewrite churns", () => {
    const before = JSON.stringify({ experiences: [{ id: "one", bullets: "Same" }] });
    const after = JSON.stringify({ experiences: [{ id: "two", bullets: "Same" }] });
    expect(diffDocuments(before, after).summary).toBe("Nothing changed.");
  });
});
