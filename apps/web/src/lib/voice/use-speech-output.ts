"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechOutputState = "idle" | "speaking" | "unsupported";

export type UseSpeechOutputOptions = {
  language?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceURI?: string;
};

export type UseSpeechOutputReturn = {
  state: SpeechOutputState;
  isSupported: boolean;
  speak: (text: string) => void;
  stop: () => void;
  voices: SpeechSynthesisVoice[];
};

export function useSpeechOutput({
  language = "en-US",
  rate = 1.05,
  pitch = 1,
  volume = 1,
  voiceURI,
}: UseSpeechOutputOptions = {}): UseSpeechOutputReturn {
  const [state, setState] = useState<SpeechOutputState>("idle");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, [isSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported || !text.trim()) return;

      // Stop any current speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      // Find a preferred voice
      const availableVoices = window.speechSynthesis.getVoices();

      if (voiceURI) {
        const preferred = availableVoices.find((v) => v.voiceURI === voiceURI);
        if (preferred) utterance.voice = preferred;
      } else {
        // Prefer a natural-sounding English voice
        const natural = availableVoices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.toLowerCase().includes("natural") ||
              v.name.toLowerCase().includes("neural") ||
              v.name.toLowerCase().includes("enhanced")),
        );
        if (natural) utterance.voice = natural;
      }

      utterance.onstart = () => setState("speaking");
      utterance.onend = () => {
        setState("idle");
        utteranceRef.current = null;
      };
      utterance.onerror = () => {
        setState("idle");
        utteranceRef.current = null;
      };

      utteranceRef.current = utterance;
      setState("speaking");
      window.speechSynthesis.speak(utterance);
    },
    [isSupported, language, rate, pitch, volume, voiceURI],
  );

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setState("idle");
  }, [isSupported]);

  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  return {
    state,
    isSupported,
    speak,
    stop,
    voices,
  };
}
