import { describe, expect, it } from "vitest";

import { placeDictation } from "./dictation-target";

const BULLETS = "Assisted clients with level 2 support.\nPerformed regular system backups.";

/** Every character of `needle` appears in `haystack`, in order — i.e. nothing deleted. */
function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) if (i < needle.length && ch === needle[i]) i += 1;
  return i === needle.length;
}

describe("placeDictation — the caret is the target", () => {
  it("APPENDS when the field isn't focused (new content, not an edit)", () => {
    const r = placeDictation("Configured cloud environments.", {
      value: BULLETS,
      selectionStart: null,
      selectionEnd: null,
      separator: "\n",
    });
    expect(r.mode).toBe("append");
    expect(r.value).toBe(`${BULLETS}\nConfigured cloud environments.`);
  });

  it("REPLACES the selection — 'rewrite this bullet'", () => {
    // User highlights the first bullet and speaks a better version of it.
    const start = 0;
    const end = "Assisted clients with level 2 support.".length;
    const r = placeDictation("Handled level 2 escalations for client systems.", {
      value: BULLETS,
      selectionStart: start,
      selectionEnd: end,
    });
    expect(r.mode).toBe("replace");
    expect(r.value).toBe(
      "Handled level 2 escalations for client systems.\nPerformed regular system backups.",
    );
    // Nothing else was touched.
    expect(r.value).toContain("Performed regular system backups.");
  });

  it("INSERTS at a caret placed mid-text, spacing the surrounding words", () => {
    const r = placeDictation("and Azure", {
      value: "Deployed to AWS today",
      selectionStart: "Deployed to AWS".length,
      selectionEnd: "Deployed to AWS".length,
    });
    expect(r.mode).toBe("insert");
    expect(r.value).toBe("Deployed to AWS and Azure today");
  });

  it("does not double-space when the caret already sits on whitespace", () => {
    const r = placeDictation("Azure", {
      value: "Deployed to  today",
      selectionStart: "Deployed to ".length,
      selectionEnd: "Deployed to ".length,
    });
    expect(r.value).toBe("Deployed to Azure today");
  });

  it("treats a caret at the end as an append", () => {
    const r = placeDictation("More.", {
      value: "Existing text.",
      selectionStart: "Existing text.".length,
      selectionEnd: "Existing text.".length,
    });
    expect(r.mode).toBe("append");
    expect(r.value).toBe("Existing text. More.");
  });

  it("only ever removes text the user explicitly selected", () => {
    // The invariant is "nothing is DELETED without a selection" — not "lines stay
    // contiguous". A caret mid-word legitimately splits that word, exactly as typing
    // there would; that's an insertion, not a loss.
    const cases = [
      { selectionStart: null, selectionEnd: null },
      { selectionStart: 5, selectionEnd: 5 }, // mid-word, on purpose
      { selectionStart: 0, selectionEnd: 0 },
    ];
    for (const sel of cases) {
      const r = placeDictation("New words.", { value: BULLETS, ...sel });
      // Nothing deleted == every original character still present, in order.
      expect(isSubsequence(BULLETS, r.value), `lost text with selection ${JSON.stringify(sel)}`).toBe(
        true,
      );
    }
  });

  it("puts the caret after what was just inserted, so speech chains naturally", () => {
    const r = placeDictation("Azure", {
      value: "Deployed to AWS today",
      selectionStart: "Deployed to AWS".length,
      selectionEnd: "Deployed to AWS".length,
    });
    expect(r.value.slice(0, r.caret)).toBe("Deployed to AWS Azure");
  });

  it("is a no-op for empty dictation — silence never edits the document", () => {
    const r = placeDictation("   ", { value: BULLETS, selectionStart: 0, selectionEnd: 10 });
    expect(r.value).toBe(BULLETS);
  });

  it("handles a backwards selection (dragged right-to-left)", () => {
    const r = placeDictation("X", { value: "abcdef", selectionStart: 5, selectionEnd: 2 });
    expect(r.value).toBe("abXf");
  });

  it("fills an empty field without a leading separator", () => {
    const r = placeDictation("First bullet.", {
      value: "",
      selectionStart: null,
      selectionEnd: null,
      separator: "\n",
    });
    expect(r.value).toBe("First bullet.");
  });
});
