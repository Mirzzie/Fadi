import { describe, expect, it } from "vitest";

import { readBack, toSpeech } from "./speech";

describe("toSpeech", () => {
  it("drops markup and links but keeps what was said", () => {
    expect(
      toSpeech(
        "## Top roles\n- **SOC Analyst** at Acme\n- Junior Engineer at [Stripe](https://stripe.com)"
      )
    ).toBe("Top roles SOC Analyst at Acme. Junior Engineer at Stripe.");
    expect(toSpeech("See https://example.com/jobs?id=1 for more.")).toBe("See for more.");
  });

  it("stops at a sentence boundary near the word limit", () => {
    const long = "One two three four five. Six seven eight nine ten. Eleven twelve thirteen.";
    expect(toSpeech(long, 8)).toBe("One two three four five.");
  });

  it("cuts mid-sentence only when there is no sentence end to stop at", () => {
    expect(toSpeech("a b c d e f g h i j", 4)).toBe("a b c d…");
  });
});

describe("readBack", () => {
  it("names the action and the details it will use", () => {
    expect(
      readBack("track_application", {
        company: "Stripe",
        title: "Backend Engineer",
        status: "applied",
      })
    ).toBe("track application — company: Stripe, title: Backend Engineer, status: applied");
  });

  it("leaves out objects and empty values", () => {
    expect(
      readBack("generate_document", { kind: "resume", extra: { a: 1 }, note: "", jd: "null" })
    ).toBe(
      "generate document — kind: resume"
    );
  });
});
