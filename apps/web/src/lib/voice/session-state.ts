import type { GroqVoiceState } from "./use-groq-voice";

export type VoiceSessionPhase =
  | "idle"
  | "requesting"
  | "speaking"
  | "listening"
  | "transcribing"
  | "thinking"
  | "ready"
  | "error";

/** Long enough for a deliberate interview pause; dictation uses a much shorter silence. */
export const INTERVIEW_THOUGHTFUL_PAUSE_MS = 4_000;

export function resolveVoiceSessionPhase(input: {
  recorder: GroqVoiceState;
  speaking?: boolean;
  thinking?: boolean;
  ready?: boolean;
  error?: boolean;
}): VoiceSessionPhase {
  if (input.error) return "error";
  if (input.speaking) return "speaking";
  if (input.recorder === "requesting") return "requesting";
  if (input.recorder === "recording") return "listening";
  if (input.recorder === "transcribing") return "transcribing";
  if (input.thinking) return "thinking";
  if (input.ready) return "ready";
  return "idle";
}

export const VOICE_SESSION_LABEL: Record<VoiceSessionPhase, string> = {
  idle: "Ready",
  requesting: "Waiting for microphone permission",
  speaking: "Fadi is speaking",
  listening: "Listening",
  transcribing: "Turning your answer into text",
  thinking: "Reviewing your answer",
  ready: "Answer ready",
  error: "Needs attention",
};
