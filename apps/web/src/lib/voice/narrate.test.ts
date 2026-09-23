import { describe, expect, it } from "vitest";

import { narrateNext, narratePlan, narrateReceipts, narrateToday } from "./narrate";
import type { Today } from "@/lib/work/today";

function today(over: Partial<Today> = {}): Today {
  return {
    firstName: "Mirzad",
    goal: { id: "g", title: "land a support role in Dublin", reason: "", source: "goal" },
    proposal: null,
    plan: null,
    action: null,
    alsoOpen: [],
    otherGoals: [],
    receipts: [],
    lastPassLabel: null,
    decisions: [],
    suggestions: [],
    ...over,
  };
}

function step(over: Partial<Today["plan"] extends null ? never : NonNullable<Today["plan"]>["steps"][number]> = {}) {
  return {
    id: "s",
    title: "Check the posting is still open",
    reason: "",
    status: "open",
    automatic: true,
    outcome: "",
    output: null,
    note: "",
    ...over,
  };
}

describe("Fadi out loud", () => {
  it("leads with the goal, then what is happening", () => {
    const said = narrateToday(
      today({
        plan: {
          id: "p",
          title: "Apply to Deerfoot — Support Analyst",
          fadiCanContinue: true,
          steps: [
            step({ id: "1", status: "done", outcome: "Still open." }),
            step({ id: "2", title: "Check whether you are a fit" }),
          ],
        },
      })
    );

    expect(said).toContain("working towards land a support role in Dublin");
    expect(said).toContain("Apply to Deerfoot");
    expect(said).toContain("1 of 2 steps done");
    expect(said).toContain("Say carry on");
  });

  /** Whose step it is decides what the person should do next, so it is always said. */
  it("says plainly when the next step is theirs, not Fadi's", () => {
    const withManual = today({
      plan: {
        id: "p",
        title: "Apply to Deerfoot",
        fadiCanContinue: false,
        steps: [step({ id: "1", title: "Read it, then send it", automatic: false })],
      },
    });

    expect(narrateNext(withManual)).toContain("That one's yours");
    expect(narrateNext(withManual)).not.toContain("carry on");
  });

  it("offers the two words that answer a proposal", () => {
    const said = narrateToday(
      today({ proposal: { id: "p", title: "Apply to Omni — Product Expert", steps: 6 } })
    );
    expect(said).toContain("lined up");
    expect(said).toContain("6 steps");
    expect(said).toContain("Say start it, or not now");
  });

  it("reads a stopped step with the reason it stopped", () => {
    const said = narratePlan(
      today({
        plan: {
          id: "p",
          title: "Apply to Deerfoot",
          fadiCanContinue: false,
          steps: [step({ id: "1", status: "blocked", note: "That posting has closed." })],
        },
      })
    );
    expect(said).toContain("Stopped at");
    expect(said).toContain("That posting has closed.");
  });

  /** Receipts are the only thing that may claim Fadi did something. */
  it("says nothing was done when nothing was", () => {
    expect(narrateReceipts(today())).toBe("I haven't done anything on your behalf yet.");
  });

  it("does not call a failed attempt a success when reading it back", () => {
    const said = narrateReceipts(
      today({
        receipts: [
          {
            id: "r",
            action: "Draft and save a document",
            status: "failed",
            receipt: "",
            error: "no provider",
            atLabel: "2 minutes ago",
          },
        ],
      })
    );
    expect(said).toContain("which failed");
  });

  it("tells someone with no goal that they have none", () => {
    const said = narrateToday(
      today({ goal: { id: null, title: "", reason: "", source: "none" } })
    );
    expect(said).toContain("haven't set what you're working towards");
  });
});
