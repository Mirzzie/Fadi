import { describe, expect, it } from "vitest";

import { figuresAskedButNotWritten } from "@/lib/documents/improve-figures";

describe("saying which figures Fadi would not write", () => {
  const corpus = "Reduced AWS costs by 10% at Crozaint. Handled 100% of tickets within SLA.";

  it("THE REPORTED SILENCE: an unsupported figure is named, not quietly dropped", () => {
    // Asked to "add that I cut cloud costs by 47%", the model refused (correctly) and Fadi
    // reported a plain "Rewritten", implying the number was in.
    const result = "Reduced AWS costs by 10% through automation.";
    expect(figuresAskedButNotWritten("Add that I cut cloud costs by 47%", corpus, result)).toEqual(["47%"]);
  });

  it("a figure the record supports is not reported as declined", () => {
    expect(figuresAskedButNotWritten("Mention the 10% cost saving", corpus, "Cut costs 10%.")).toEqual([]);
  });

  it("a figure the rewrite did write is not reported as declined", () => {
    expect(
      figuresAskedButNotWritten("Say 100% SLA", corpus, "Kept 100% of tickets within SLA.")
    ).toEqual([]);
  });

  it("an instruction with no figures reports nothing", () => {
    expect(figuresAskedButNotWritten("Make the bullets stronger", corpus, "Stronger bullets.")).toEqual([]);
  });
});
