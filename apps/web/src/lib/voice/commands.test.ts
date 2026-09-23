import { describe, expect, it } from "vitest";

import { flatten, parseVoiceCommand } from "./commands";

/**
 * These are written for the person who cannot see the screen. The test that matters most is
 * the last one: what Fadi does with something it did not understand.
 */
describe("hearing a command", () => {
  it("takes the name off the front, however Whisper spelt it", () => {
    for (const said of [
      "Hey Fadi, what's next?",
      "Fadi what's next",
      "Friday, what's next.",
      "OK Fadi — what's next?",
    ]) {
      expect(parseVoiceCommand(said), said).toEqual({ kind: "read", what: "next" });
    }
  });

  it("answers the questions an eyes-free session actually asks", () => {
    expect(parseVoiceCommand("what's on today")).toEqual({ kind: "read", what: "today" });
    expect(parseVoiceCommand("catch me up")).toEqual({ kind: "read", what: "today" });
    expect(parseVoiceCommand("read me the plan")).toEqual({ kind: "read", what: "plan" });
    expect(parseVoiceCommand("what have you done")).toEqual({ kind: "read", what: "did" });
  });

  it("drives the plan in the words people use for it", () => {
    expect(parseVoiceCommand("do the next step")).toEqual({ kind: "advance" });
    expect(parseVoiceCommand("carry on")).toEqual({ kind: "advance" });
    expect(parseVoiceCommand("keep going")).toEqual({ kind: "advance" });
    expect(parseVoiceCommand("start it")).toEqual({ kind: "startProposal", confirm: true });
    expect(parseVoiceCommand("not now")).toEqual({ kind: "no" });
    expect(parseVoiceCommand("stop the plan")).toEqual({ kind: "stopPlan", confirm: true });
  });

  /** Nothing that changes anything may happen without being asked out loud first. */
  it("marks everything consequential for confirmation", () => {
    for (const said of ["apply to the Deerfoot role", "start it", "stop the plan", "skip it"]) {
      const command = parseVoiceCommand(said);
      expect("confirm" in command && command.confirm, said).toBe(true);
    }
    // Reading and moving change nothing, so they do not interrupt to ask.
    expect(parseVoiceCommand("what's next")).not.toHaveProperty("confirm");
    expect(parseVoiceCommand("open my career")).not.toHaveProperty("confirm");
  });

  it("goes only where a real area exists", () => {
    expect(parseVoiceCommand("open my career")).toMatchObject({
      kind: "navigate",
      href: "/dashboard/evidence",
    });
    expect(parseVoiceCommand("take me to applications")).toMatchObject({
      kind: "navigate",
      href: "/dashboard/applications",
    });
    expect(parseVoiceCommand("show me the portfolio page")).toMatchObject({
      kind: "navigate",
      href: "/dashboard/portfolio",
    });
    // Not an area — so it is a thing to look up in this person's own records, and the server
    // decides whether it exists. What must never happen is landing on a plausible-looking page.
    const unknown = parseVoiceCommand("open the billing settings for my invoices");
    expect(unknown.kind).toBe("open");
    expect(unknown).not.toHaveProperty("href");
  });

  it("carries the role through so the server can name it back", () => {
    expect(parseVoiceCommand("apply to the Deerfoot support role")).toEqual({
      kind: "apply",
      target: "deerfoot support role",
      confirm: true,
    });
    expect(parseVoiceCommand("tailor my CV for Intercom")).toMatchObject({
      kind: "apply",
      target: "intercom",
    });
  });

  it("hears yes and no plainly, because they answer a question about to act", () => {
    for (const yes of ["yes", "yeah", "go ahead", "do it", "confirm"]) {
      expect(parseVoiceCommand(yes), yes).toEqual({ kind: "yes" });
    }
    for (const no of ["no", "nope", "cancel", "never mind"]) {
      expect(parseVoiceCommand(no), no).toEqual({ kind: "no" });
    }
  });

  it("can be told to be quiet, and to stop listening", () => {
    expect(parseVoiceCommand("stop talking")).toEqual({ kind: "stopTalking" });
    expect(parseVoiceCommand("go to sleep")).toEqual({ kind: "sleep" });
    expect(parseVoiceCommand("that's all")).toEqual({ kind: "sleep" });
  });

  /**
   * THE ONE THAT MATTERS. Someone watching can see Fadi do the wrong thing and undo it.
   * Someone with their eyes shut cannot, so silence and a guess are both unacceptable — an
   * instruction it does not recognise becomes a question, and noise becomes nothing at all.
   */
  it("never guesses at an instruction it does not know", () => {
    expect(parseVoiceCommand("")).toEqual({ kind: "unknown" });
    expect(parseVoiceCommand("   ...  ")).toEqual({ kind: "unknown" });
    expect(parseVoiceCommand("hey fadi")).toEqual({ kind: "unknown" });

    // Plausible but not a command Fadi has: asked, not acted on.
    expect(parseVoiceCommand("delete everything").kind).toBe("ask");
    expect(parseVoiceCommand("send my application to Google").kind).toBe("ask");
  });
});

/**
 * Whisper punctuates everything. Every one of these arrived as a question for the chat instead
 * of the command it plainly is — "Hi, open opportunities." came back as a table of jobs.
 */
describe("what a transcriber actually sends", () => {
  it("is not defeated by a full stop", () => {
    expect(parseVoiceCommand("Hi, open opportunities.")).toMatchObject({
      kind: "navigate",
      href: "/dashboard/jobs",
    });
    expect(parseVoiceCommand("Open my career.")).toMatchObject({
      kind: "navigate",
      href: "/dashboard/evidence",
    });
    expect(parseVoiceCommand("What's next?")).toEqual({ kind: "read", what: "next" });
    expect(parseVoiceCommand("Carry on.")).toEqual({ kind: "advance" });
    expect(parseVoiceCommand("Yes.")).toEqual({ kind: "yes" });
  });

  it("does not carry punctuation into the thing it looks up", () => {
    expect(parseVoiceCommand("Apply to the Deerfoot role.")).toEqual({
      kind: "apply",
      target: "deerfoot role",
      confirm: true,
    });
  });

  /** A dot inside a word is part of the word, not punctuation. */
  it("keeps the dots that belong to a name", () => {
    expect(flatten("Node.js and C#.NET")).toBe("node.js and c#.net");
  });
});


/**
 * Reaching a THING by name, not a page by position. This is what makes hands-free use general:
 * the platform's own records are what a spoken name resolves against.
 */
describe("opening and taking on things by name", () => {
  it("passes an unrecognised name to the server to look up", () => {
    expect(parseVoiceCommand("open the Deerfoot job")).toEqual({
      kind: "open",
      target: "the deerfoot job",
    });
    expect(parseVoiceCommand("open my Stripe cover letter.")).toMatchObject({ kind: "open" });
  });

  it("hears every word people use for taking a course on, and asks first", () => {
    for (const said of [
      "commit to the Splunk fundamentals course",
      "enrol in Splunk fundamentals",
      "sign up for Splunk fundamentals",
      "take on Splunk fundamentals",
    ]) {
      const command = parseVoiceCommand(said);
      expect(command.kind, said).toBe("commit");
      expect("confirm" in command && command.confirm, said).toBe(true);
      expect(command.kind === "commit" && command.topic).toContain("splunk fundamentals");
    }
  });

  it("asks before saving a role, and keeps the name it heard", () => {
    expect(parseVoiceCommand("save the Deerfoot role")).toEqual({
      kind: "saveJob",
      target: "deerfoot role",
      confirm: true,
    });
  });

  /** An area still wins over a lookup: "open practice" is a place, not a project. */
  it("prefers a real area over a thing with a similar name", () => {
    expect(parseVoiceCommand("open practice")).toMatchObject({
      kind: "navigate",
      href: "/dashboard/learning",
    });
  });
});
