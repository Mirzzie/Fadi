import { describe, expect, it } from "vitest";

import { parseVoiceCommand } from "./commands";

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
    // No such place — asked as a question rather than sent somewhere plausible.
    expect(parseVoiceCommand("open the billing settings for my invoices").kind).toBe("ask");
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
