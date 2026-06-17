"use client";

import { useCallback, useEffect, useState } from "react";

import { speakFadi, stopFadiSpeech, subscribeFadiSpeaking } from "./fadi-speech";

export type SpeechOutputState = "idle" | "speaking" | "unsupported";

export type UseSpeechOutputOptions = {
  language?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceURI?: string;
  preferMale?: boolean;
};

export type UseSpeechOutputReturn = {
  state: SpeechOutputState;
  isSupported: boolean;
  speak: (text: string) => void;
  stop: () => void;
  voices: SpeechSynthesisVoice[];
};

/**
 * Fadi's voice. Delegates to the shared speech controller, which prefers premium
 * neural TTS (Groq/OpenAI) and falls back to the browser voice — so this same hook
 * drives the chat, the briefing, the boot greeting, and onboarding, and the living
 * core reacts to all of them. Options are kept for compatibility; the voice itself
 * is chosen server-side (or a male browser voice on fallback).
 */
export function useSpeechOutput(_options: UseSpeechOutputOptions = {}): UseSpeechOutputReturn {
  const [state, setState] = useState<SpeechOutputState>("idle");

  useEffect(() => subscribeFadiSpeaking((speaking) => setState(speaking ? "speaking" : "idle")), []);

  const speak = useCallback((text: string) => {
    void speakFadi(text);
  }, []);
  const stop = useCallback(() => stopFadiSpeech(), []);

  // Cloud TTS + an HTMLAudioElement work in any modern browser; treat as supported
  // on the client (components still gate their controls behind a mounted check).
  const isSupported = typeof window !== "undefined";

  return { state, isSupported, speak, stop, voices: [] };
}
