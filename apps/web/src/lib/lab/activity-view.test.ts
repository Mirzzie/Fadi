import { describe, expect, it } from "vitest";

import { groupActivity, type ActivityRow } from "./activity-view";

/**
 * The activity log was complete at the wrong level: one "check what is running" produced
 * five monospace lines, three of which were only "not installed here". That is technically
 * everything and practically unreadable, and a log people stop reading is not oversight.
 */

const at = (minutes: number) => new Date(Date.UTC(2026, 8, 11, 12, minutes)).toISOString();

const row = (over: Partial<ActivityRow>): ActivityRow => ({
  id: Math.random().toString(36),
  actor: "user",
  origin: "dashboard",
  capability: "inspect.containers",
  command: "docker version",
  decision: "allowed",
  detail: "Docker 29.7.2",
  at: at(0),
  ...over,
});

describe("folding rows into intents", () => {
  it("folds one check's several commands into a single readable line", () => {
    const groups = groupActivity([
      row({ command: "docker version", decision: "allowed" }),
      row({ command: "podman --version", decision: "unavailable", at: at(0) }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("Checked for container runtimes");
    // The fold is stated, not hidden: what came of it, in words.
    expect(groups[0].summary).toContain("2 checks");
    expect(groups[0].summary).toContain("1 worked");
    expect(groups[0].summary).toContain("not installed here");
  });

  it("NEVER folds a refusal — it is the one line worth reading", () => {
    const groups = groupActivity([
      row({ decision: "allowed" }),
      row({ decision: "denied", detail: "No live grant.", at: at(0) }),
      row({ decision: "allowed", at: at(0) }),
    ]);

    const denied = groups.filter((g) => g.outcome === "denied");
    expect(denied).toHaveLength(1);
    expect(denied[0].rows).toHaveLength(1);
    // And nothing folds INTO it either, which would bury it just as effectively.
    expect(groups.length).toBeGreaterThan(1);
  });

  it("keeps separate attempts separate when they are minutes apart", () => {
    const groups = groupActivity([row({ at: at(0) }), row({ at: at(30) })]);
    expect(groups).toHaveLength(2);
  });

  it("does not fold across actors — who asked is the point", () => {
    const groups = groupActivity([row({ actor: "user" }), row({ actor: "model", at: at(0) })]);
    expect(groups).toHaveLength(2);
  });

  it("reports a mixed result as mixed rather than picking the flattering one", () => {
    const groups = groupActivity([
      row({ decision: "allowed" }),
      row({ decision: "error", at: at(0) }),
    ]);
    expect(groups[0].outcome).toBe("mixed");
  });

  it("names capabilities in words a person uses", () => {
    expect(groupActivity([row({ capability: "network.sweep" })])[0].title).toBe("Scanned the network");
    expect(groupActivity([row({ capability: "machine.forget" })])[0].title).toBe("Removed a machine");
    // An unknown capability falls back to its id rather than to something invented.
    expect(groupActivity([row({ capability: "something.new" })])[0].title).toBe("something.new");
  });
});
