"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

function getSpeechSupport(): boolean {
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
}

export type SpeechInputState =
  | "idle"
  | "listening"
  | "processing"
  | "error"
  | "unsupported";

export type UseSpeechInputOptions = {
  language?: string;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
};

export type UseSpeechInputReturn = {
  state: SpeechInputState;
  interimTranscript: string;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
};

type WebSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
  onerror: ((event: WebSpeechRecognitionError) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type WebSpeechRecognitionEvent = {
  resultIndex: number;
  results: Array<{ isFinal: boolean; 0: { transcript: string } }> & { length: number };
};

type WebSpeechRecognitionError = {
  error: string;
};

type SpeechWindow = {
  SpeechRecognition?: new () => WebSpeechRecognition;
  webkitSpeechRecognition?: new () => WebSpeechRecognition;
};

export function useSpeechInput({
  language = "en-US",
  onTranscript,
  onError,
}: UseSpeechInputOptions = {}): UseSpeechInputReturn {
  const [state, setState] = useState<SpeechInputState>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);

  // SSR-safe browser capability read: false on the server, real value after
  // hydration. Deriving "unsupported" from this avoids setState-in-effect.
  const isSupported = useSyncExternalStore(noopSubscribe, getSpeechSupport, () => false);

  const effectiveState: SpeechInputState = isSupported ? state : "unsupported";

  const start = useCallback(() => {
    if (!isSupported) return;

    const speechWindow = window as unknown as SpeechWindow;
    const SpeechRecognitionImpl =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionImpl) return;

    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => {
      setState("listening");
      setInterimTranscript("");
    };

    recognition.onresult = (event: WebSpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;

        if (result.isFinal) {
          final += result[0]?.transcript ?? "";
        } else {
          interim += result[0]?.transcript ?? "";
        }
      }

      setInterimTranscript(interim);

      if (final) {
        setInterimTranscript("");
        onTranscript?.(final.trim(), true);
      } else if (interim) {
        onTranscript?.(interim.trim(), false);
      }
    };

    recognition.onerror = (event: WebSpeechRecognitionError) => {
      // "aborted" / "no-speech" are normal lifecycle events (e.g. the mic was
      // handed off or the user paused) — not real errors. Don't alarm the user.
      if (event.error === "aborted" || event.error === "no-speech") {
        setState("idle");
        return;
      }
      // "network" / "audio-capture" are recoverable: the browser couldn't reach
      // its speech service or the mic blipped. Go idle so the hands-free loop can
      // retry; surface a calm, actionable note instead of a red "error".
      if (event.error === "network" || event.error === "audio-capture") {
        setState("idle");
        onError?.(
          event.error === "network"
            ? "Voice couldn't reach the speech service (browser speech needs a connection). You can keep typing, or try the mic again."
            : "Couldn't access the microphone. Check it's connected and permitted, then try again.",
        );
        return;
      }
      setState("error");
      const message =
        event.error === "not-allowed"
          ? "Microphone access was denied. Allow microphone permissions to use voice input."
          : `Voice input error: ${event.error}`;
      onError?.(message);
    };

    recognition.onend = () => {
      setState("idle");
      setInterimTranscript("");
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, language, onTranscript, onError]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setState("idle");
    setInterimTranscript("");
  }, []);

  useEffect(() => {
    const ref = recognitionRef;
    return () => {
      ref.current?.abort();
    };
  }, []);

  return {
    state: effectiveState,
    interimTranscript,
    isSupported,
    start,
    stop,
  };
}
