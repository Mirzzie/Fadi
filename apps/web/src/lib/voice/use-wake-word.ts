"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Continuous "Hey Scout" wake-word listener (browser Web Speech API). When
 * enabled it listens in the background and fires `onWake` when it hears the
 * phrase, then keeps listening. Honest limits: Chrome/Edge only, needs mic
 * permission, and only works while the tab is open (a web app can't listen when
 * closed). Auto-restarts because Web Speech stops itself after pauses.
 */

type WebSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechWindow = {
  SpeechRecognition?: new () => WebSpeechRecognition;
  webkitSpeechRecognition?: new () => WebSpeechRecognition;
};

const WAKE_PATTERNS = [/\bhey,?\s*scout\b/i, /\bhi,?\s*scout\b/i, /\bok,?\s*scout\b/i, /\bhey,?\s* ky\b/i];

function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
}

export function useWakeWord(onWake: () => void) {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const enabledRef = useRef(false);
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;
  // SSR-safe: false on the server AND the first client render (so the markup
  // matches), then resolves to the real capability after mount. Computing it
  // from `window` during render caused a hydration mismatch in the menu bar.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const supported = mounted && isSupported();

  const stop = useCallback(() => {
    enabledRef.current = false;
    setEnabled(false);
    recognitionRef.current?.abort();
    recognitionRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (!supported) {
      setError("Voice isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    enabledRef.current = true;
    setEnabled(true);
    setError(null);

    const speechWindow = window as unknown as SpeechWindow;
    const Impl = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Impl) return;

    const recognition = new Impl();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let heard = "";
      for (let i = 0; i < event.results.length; i++) {
        heard += event.results[i]?.[0]?.transcript ?? "";
      }
      if (WAKE_PATTERNS.some((p) => p.test(heard))) {
        // Release the mic first (disable so onend won't auto-restart), THEN
        // summon Scout — otherwise the wake listener and Scout's own recogniser
        // fight over the microphone and one aborts. User re-toggles "Hey Scout"
        // after the conversation, which is honest, single-mic behaviour.
        enabledRef.current = false;
        setEnabled(false);
        recognition.stop();
        onWakeRef.current();
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setError("Microphone access denied. Allow it to use “Hey Scout”.");
        stop();
      }
      // "no-speech"/"aborted" are normal; onend will restart.
    };

    recognition.onend = () => {
      // Keep listening as long as the user left it enabled.
      if (enabledRef.current) {
        try {
          recognition.start();
        } catch {
          /* already starting — ignore */
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      /* ignore double-start */
    }
  }, [supported, stop]);

  const toggle = useCallback(() => {
    if (enabledRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => {
    return () => {
      enabledRef.current = false;
      recognitionRef.current?.abort();
    };
  }, []);

  return { enabled, supported, error, toggle, start, stop };
}
