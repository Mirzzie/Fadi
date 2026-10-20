/**
 * The one user-facing state vocabulary shared by Fadi's shell, voice, screen and work runtimes.
 * Keep transport-specific phases (for example, speech transcription) in their own adapters and
 * translate them at the boundary instead of teaching every surface another state machine.
 */
export const FADI_RUNTIME_STATES = [
  "ready",
  "listening",
  "understanding",
  "speaking",
  "acting",
  "waiting_for_approval",
  "blocked",
  "offline",
] as const;

export type FadiRuntimeState = (typeof FADI_RUNTIME_STATES)[number];

export const FADI_STATE_LABEL: Record<FadiRuntimeState, string> = {
  ready: "Ready",
  listening: "Listening",
  understanding: "Understanding",
  speaking: "Speaking",
  acting: "Acting",
  waiting_for_approval: "Waiting for you",
  blocked: "Needs help",
  offline: "Offline",
};

/** Safety and human-decision states win over optimistic activity. */
export function resolveFadiRuntimeState(input: {
  online?: boolean;
  blocked?: boolean;
  waitingForApproval?: boolean;
  acting?: boolean;
  speaking?: boolean;
  listening?: boolean;
  understanding?: boolean;
}): FadiRuntimeState {
  if (input.online === false) return "offline";
  if (input.blocked) return "blocked";
  if (input.waitingForApproval) return "waiting_for_approval";
  if (input.acting) return "acting";
  if (input.speaking) return "speaking";
  if (input.listening) return "listening";
  if (input.understanding) return "understanding";
  return "ready";
}
