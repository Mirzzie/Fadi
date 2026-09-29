import { describe, expect, it } from "vitest";

import { INTERVIEW_THOUGHTFUL_PAUSE_MS, resolveVoiceSessionPhase } from "./session-state";

describe("shared voice session state", () => {
  it("keeps enough silence for a thoughtful interview pause", () => {
    expect(INTERVIEW_THOUGHTFUL_PAUSE_MS).toBe(4_000);
  });

  it("shows the real turn instead of calling every active session listening", () => {
    expect(resolveVoiceSessionPhase({ recorder: "idle", speaking: true })).toBe("speaking");
    expect(resolveVoiceSessionPhase({ recorder: "recording" })).toBe("listening");
    expect(resolveVoiceSessionPhase({ recorder: "transcribing" })).toBe("transcribing");
    expect(resolveVoiceSessionPhase({ recorder: "idle", thinking: true })).toBe("thinking");
  });

  it("puts safety and permission states ahead of optimistic ready states", () => {
    expect(resolveVoiceSessionPhase({ recorder: "requesting", ready: true, thinking: true })).toBe(
      "requesting"
    );
    expect(resolveVoiceSessionPhase({ recorder: "idle", error: true, speaking: true })).toBe(
      "error"
    );
  });
});
