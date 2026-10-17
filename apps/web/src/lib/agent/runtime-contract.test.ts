import { describe, expect, it } from "vitest";

import {
  parseScreenCommands,
  parseSessionEnvelope,
  resolveFadiRuntimeState,
} from "./runtime-contract";

const envelope = {
  version: 1,
  sessionId: "session-1",
  correlationId: "turn-1",
  userId: "user-1",
  modality: "voice",
  state: "listening",
  route: { pathname: "/dashboard/applications/abc/workspace", revision: "screen-7" },
  activeGoalId: "goal-1",
  workItemId: "step-1",
  directionId: "direction-1",
  entityRefs: [{ type: "application", id: "abc" }],
  policyVersion: "2026-10-16",
  createdAt: "2026-10-16T18:00:00.000Z",
};

describe("shared Fadi runtime contract", () => {
  it("accepts a bounded session envelope shared by voice, screen and task workers", () => {
    expect(parseSessionEnvelope(envelope)).toEqual(envelope);
  });

  it("rejects hidden payloads, external routes and unbounded context", () => {
    expect(() => parseSessionEnvelope({ ...envelope, transcript: "private answer" })).toThrow();
    expect(() =>
      parseSessionEnvelope({
        ...envelope,
        route: { pathname: "https://evil.example", revision: null },
      })
    ).toThrow();
    expect(() =>
      parseSessionEnvelope({
        ...envelope,
        entityRefs: Array.from({ length: 17 }, (_, i) => ({ type: "job", id: String(i) })),
      })
    ).toThrow();
  });

  it("uses one semantic state with safety and human decisions ahead of activity", () => {
    expect(resolveFadiRuntimeState({ listening: true })).toBe("listening");
    expect(resolveFadiRuntimeState({ speaking: true, listening: true })).toBe("speaking");
    expect(resolveFadiRuntimeState({ acting: true, speaking: true })).toBe("acting");
    expect(resolveFadiRuntimeState({ waitingForApproval: true, acting: true })).toBe(
      "waiting_for_approval"
    );
    expect(resolveFadiRuntimeState({ blocked: true, waitingForApproval: true })).toBe("blocked");
    expect(resolveFadiRuntimeState({ online: false, blocked: true })).toBe("offline");
  });

  it("allows bounded semantic screen commands with optimistic revision checks", () => {
    expect(
      parseScreenCommands([
        {
          type: "navigate",
          commandId: "command-1",
          expectedRevision: "screen-7",
          href: "/dashboard/applications",
        },
        {
          type: "set_draft_value",
          commandId: "command-2",
          expectedRevision: "screen-7",
          fieldId: "application-note",
          value: "Ask about the on-call rotation.",
        },
      ])
    ).toHaveLength(2);
  });

  it.each([
    [{ type: "click", commandId: "1", expectedRevision: "r", selector: "#approve" }],
    [{ type: "navigate", commandId: "1", expectedRevision: "r", href: "https://evil.example" }],
    [{ type: "navigate", commandId: "1", expectedRevision: "r", href: "//evil.example" }],
    [{ type: "submit", commandId: "1", expectedRevision: "r", form: "application" }],
    [{ type: "delete", commandId: "1", expectedRevision: "r", id: "job-1" }],
  ])("rejects arbitrary or consequential UI mutation %#", (commands) => {
    expect(() => parseScreenCommands(commands)).toThrow();
  });

  it("rejects stale-uncheckable commands and oversized batches", () => {
    expect(() =>
      parseScreenCommands([{ type: "focus_field", commandId: "1", fieldId: "notes" }])
    ).toThrow();
    expect(() =>
      parseScreenCommands(
        Array.from({ length: 9 }, (_, i) => ({
          type: "focus_field",
          commandId: `c-${i}`,
          expectedRevision: "r-1",
          fieldId: `field-${i}`,
        }))
      )
    ).toThrow();
  });
});
