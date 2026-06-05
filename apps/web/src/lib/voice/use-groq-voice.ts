"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Server-side voice input: record the mic, auto-stop on silence, and transcribe
 * via Whisper (`/api/kai/transcribe` → Groq free tier). Works in ANY browser —
 * unlike the Web Speech API, which depends on Google's backend and fails on
 * Linux Chromium / Brave. No interim results (Whisper is one-shot), so the UI
 * shows "listening / transcribing" states instead.
 */

export type GroqVoiceState = "idle" | "recording" | "transcribing" | "unsupported";

type Options = {
  onTranscript?: (text: string) => void;
  onError?: (message: string) => void;
  /** Auto-stop after this much trailing silence (ms). */
  silenceMs?: number;
  /** Hard cap on a single utterance (ms). */
  maxMs?: number;
  /** Give up if the user never speaks within this window (ms). */
  noSpeechMs?: number;
};

function isAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined" &&
    typeof window !== "undefined" &&
    (typeof window.AudioContext !== "undefined" ||
      typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext !==
        "undefined")
  );
}

export function useGroqVoice({
  onTranscript,
  onError,
  silenceMs = 1400,
  maxMs = 30000,
  noSpeechMs = 6000,
}: Options = {}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [state, setState] = useState<GroqVoiceState>("idle");

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const isSupported = mounted && isAvailable();

  const teardown = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    maxTimerRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    if (recRef.current && recRef.current.state !== "inactive") {
      recRef.current.stop(); // → onstop transcribes
    }
  }, []);

  const start = useCallback(async () => {
    if (!isSupported) {
      onErrorRef.current?.("Voice recording isn't supported in this browser.");
      return;
    }
    if (recRef.current && recRef.current.state === "recording") return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onErrorRef.current?.("Couldn't access the microphone. Check it's connected and permitted.");
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];

    const rec = new MediaRecorder(stream);
    recRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = async () => {
      teardown();
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      recRef.current = null;
      if (blob.size < 1500) {
        // Too short to be speech — quietly reset.
        setState("idle");
        return;
      }
      setState("transcribing");
      try {
        const fd = new FormData();
        fd.append("audio", blob, "audio.webm");
        const res = await fetch("/api/kai/transcribe", { method: "POST", body: fd });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          onErrorRef.current?.(data.error ?? "Couldn't transcribe that. Try again.");
          setState("idle");
          return;
        }
        const { text } = (await res.json()) as { text: string };
        setState("idle");
        if (text?.trim()) onTranscriptRef.current?.(text.trim());
      } catch {
        onErrorRef.current?.("Couldn't transcribe that. Try again.");
        setState("idle");
      }
    };

    rec.start();
    setState("recording");

    // Silence detection so it ends when the user stops talking.
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    ctxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const startedAt = performance.now();
    let spoke = false;
    let silenceAt = 0;

    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      const now = performance.now();

      if (rms > 0.018) {
        spoke = true;
        silenceAt = 0;
      } else if (spoke) {
        if (silenceAt === 0) silenceAt = now;
        else if (now - silenceAt > silenceMs) {
          stop();
          return;
        }
      } else if (now - startedAt > noSpeechMs) {
        // Never heard anything — stop without transcribing.
        stop();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    maxTimerRef.current = setTimeout(stop, maxMs);
  }, [isSupported, silenceMs, maxMs, noSpeechMs, stop, teardown]);

  useEffect(() => {
    return () => {
      teardown();
      recRef.current?.stop();
    };
  }, [teardown]);

  return {
    state: isSupported ? state : "unsupported",
    isSupported,
    start,
    stop,
  };
}
