import { describe, expect, it } from "vitest";

import { composeBriefing } from "./briefing";

const MORNING = new Date("2026-06-15T09:00:00");
const EVENING = new Date("2026-06-15T20:00:00");

describe("composeBriefing", () => {
  it("greets by time of day + name and stays quiet when there's nothing real", () => {
    const b = composeBriefing({ firstName: "Mira", now: MORNING });
    expect(b.text).toMatch(/^Good morning, Mira\./);
    expect(b.text).toContain("quiet right now");
    expect(b.items).toEqual([]);
    expect(composeBriefing({ firstName: "Mira", now: EVENING }).text).toMatch(/^Good evening/);
  });

  it("falls back to a friendly name and never fabricates sections", () => {
    const b = composeBriefing({ firstName: "  ", now: MORNING });
    expect(b.text).toContain("Good morning, there.");
    expect(b.items).toEqual([]);
  });

  it("includes only the sections with real data, in order", () => {
    const b = composeBriefing({
      firstName: "Mira",
      now: MORNING,
      findings: [
        { kind: "new_role", title: "2 new SOC roles", href: "/dashboard/jobs" },
        { kind: "market_signal", title: "AI hiring up", href: "/dashboard" },
      ],
      topJob: { title: "SOC Analyst", company: "Aon" },
      signal: { title: "Cyber demand rising in Dublin" },
      momentum: { cadenceTarget: 2, cadencePeriod: "week", qualityApplicationsThisPeriod: 1, isResting: false },
      learning: { title: "Network security fundamentals" },
    });
    expect(b.text).toContain("While you were away, I found 2 new SOC roles and 1 more.");
    expect(b.text).toContain("SOC Analyst at Aon");
    expect(b.text).toContain("In your market: Cyber demand rising in Dublin.");
    expect(b.text).toContain("1 more quality application");
    expect(b.text).toContain("To learn next: Network security fundamentals.");
    expect(b.text).toContain("start a new direction");
    // Ordering: findings → job → signal → commitment → learning
    expect(b.items.map((i) => i.label)).toEqual([
      "While you were away · 2",
      "New role",
      "Market signal",
      "Commitment",
      "Learn next",
    ]);
  });

  it("respects a planned rest and a completed commitment", () => {
    const resting = composeBriefing({
      firstName: "Mira",
      now: MORNING,
      momentum: { cadenceTarget: 2, cadencePeriod: "week", qualityApplicationsThisPeriod: 0, isResting: true },
    });
    expect(resting.text).toContain("planned rest");

    const done = composeBriefing({
      firstName: "Mira",
      now: MORNING,
      momentum: { cadenceTarget: 2, cadencePeriod: "week", qualityApplicationsThisPeriod: 2, isResting: false },
    });
    expect(done.text).toContain("hit your week's commitment");
    // A met commitment is narrated but isn't an action item.
    expect(done.items.find((i) => i.label === "Commitment")).toBeUndefined();
  });
});
