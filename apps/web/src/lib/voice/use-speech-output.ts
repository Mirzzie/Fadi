"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechOutputState = "idle" | "speaking" | "unsupported";

export type UseSpeechOutputOptions = {
  language?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceURI?: string;
  /** Fadi has a male voice — prefer a male-sounding system voice. */
  preferMale?: boolean;
};

// Known male voice names across platforms (Apple, Microsoft, Google, Android).
// The Web Speech API doesn't expose gender, so we match on these + a "male" tag.
const MALE_VOICE_HINT =
  /\b(male|guy|christopher|eric|brian|davis|tony|jason|david|mark|daniel|alex|fred|aaron|arthur|oliver|rishi|tom|james|john|matthew|ryan|roger|steffan|reed|gordon|george|liam)\b/i;

const NATURAL_VOICE_HINT = /natural|neural|enhanced|online|premium|siri|wavenet/i;

/** Pick the best voice: prefer male + natural English when Fadi is speaking. */
function selectVoice(
  voices: SpeechSynthesisVoice[],
  opts: { language: string; preferMale: boolean; voiceURI?: string },
): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) return undefined;
  if (opts.voiceURI) {
    const exact = voices.find((v) => v.voiceURI === opts.voiceURI);
    if (exact) return exact;
  }
  const lang = opts.language.toLowerCase().slice(0, 2);
  const inLang = voices.filter((v) => v.lang?.toLowerCase().startsWith(lang));
  const pool = inLang.length > 0 ? inLang : voices;

  const score = (v: SpeechSynthesisVoice): number => {
    let s = 0;
    if (opts.preferMale && MALE_VOICE_HINT.test(v.name)) s += 5;
    if (NATURAL_VOICE_HINT.test(v.name)) s += 2;
    if (/^en-(us|gb)/i.test(v.lang)) s += 1;
    if (v.localService) s += 0.5; // local voices avoid network hiccups
    return s;
  };
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}

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
  preferMale = true,
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

      // Prefer Fadi's male, natural-sounding English voice.
      const chosen = selectVoice(window.speechSynthesis.getVoices(), {
        language,
        preferMale,
        voiceURI,
      });
      if (chosen) utterance.voice = chosen;

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
    [isSupported, language, rate, pitch, volume, voiceURI, preferMale],
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
