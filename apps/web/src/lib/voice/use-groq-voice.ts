"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GroqVoiceState = "idle" | "requesting" | "recording" | "transcribing" | "unsupported";
type Options = {
  onTranscript?: (text: string) => void;
  onError?: (message: string) => void;
  /** Dictation defaults to automatic ending; interviews can require an explicit finish. */
  autoStop?: boolean;
  silenceMs?: number;
  maxMs?: number;
  noSpeechMs?: number;
};

function isAvailable() {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

/** Each recording owns its stream and response. Cancel never submits an answer. */
export function useGroqVoice({
  onTranscript,
  onError,
  autoStop = true,
  silenceMs = 1400,
  maxMs = 30000,
  noSpeechMs = 6000,
}: Options = {}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [state, setState] = useState<GroqVoiceState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const attempt = useRef(0);
  const active = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const frame = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clock = useRef<ReturnType<typeof setInterval> | null>(null);
  const request = useRef<AbortController | null>(null);
  const callbacks = useRef({ onTranscript, onError });
  useEffect(() => {
    callbacks.current = { onTranscript, onError };
  }, [onTranscript, onError]);
  const isSupported = mounted && isAvailable();

  const releaseCapture = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (timer.current !== null) clearTimeout(timer.current);
    if (clock.current !== null) clearInterval(clock.current);
    frame.current = null;
    timer.current = null;
    clock.current = null;
    void context.current?.close().catch(() => {});
    context.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  const dispose = useCallback(() => {
    attempt.current += 1;
    active.current = false;
    request.current?.abort();
    request.current = null;
    if (recorder.current) {
      recorder.current.onstop = null;
      recorder.current.ondataavailable = null;
      recorder.current.onerror = null;
      if (recorder.current.state !== "inactive") recorder.current.stop();
      recorder.current = null;
    }
    releaseCapture();
  }, [releaseCapture]);

  const cancel = useCallback(() => {
    dispose();
    setState("idle");
    setElapsedMs(0);
  }, [dispose]);
  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (!isSupported) {
      callbacks.current.onError?.(
        "Voice recording isn't supported in this browser. You can type your answer."
      );
      return;
    }
    if (active.current) return;
    active.current = true;
    const id = ++attempt.current;
    const current = () => id === attempt.current;
    // The callbacks belong to the answer that started capture, not a later question.
    const ownCallbacks = callbacks.current;
    setState("requesting");
    setElapsedMs(0);
    let input: MediaStream;
    try {
      input = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      if (current()) {
        active.current = false;
        setState("idle");
        ownCallbacks.onError?.(
          "Couldn't access the microphone. Check permission, or type your answer."
        );
      }
      return;
    }
    if (!current()) {
      input.getTracks().forEach((track) => track.stop());
      return;
    }
    stream.current = input;
    try {
      const rec = new MediaRecorder(input);
      recorder.current = rec;
      const chunks: Blob[] = [];
      rec.ondataavailable = (event) => {
        if (current() && event.data.size) chunks.push(event.data);
      };
      rec.onerror = () => {
        if (!current()) return;
        cancel();
        ownCallbacks.onError?.(
          "Recording stopped unexpectedly. Please try again or type your answer."
        );
      };
      rec.onstop = async () => {
        if (!current()) return;
        releaseCapture();
        recorder.current = null;
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (!blob.size) {
          active.current = false;
          setState("idle");
          ownCallbacks.onError?.("No audio was recorded. Please try again.");
          return;
        }
        setState("transcribing");
        const controller = new AbortController();
        request.current = controller;
        try {
          const form = new FormData();
          const extension = blob.type.includes("mp4")
            ? "mp4"
            : blob.type.includes("ogg")
              ? "ogg"
              : "webm";
          form.append("audio", blob, `audio.${extension}`);
          // Tell the transcriber what language to expect. Left to guess, it guessed Icelandic
          // for an English "Hi, hello" — and a command it transcribes into another language
          // cannot match anything Fadi knows.
          form.append(
            "language",
            typeof navigator !== "undefined" && navigator.language ? navigator.language : "en"
          );
          const response = await fetch("/api/fadi/transcribe", {
            method: "POST",
            body: form,
            signal: controller.signal,
          });
          const data = (await response.json().catch(() => ({}))) as {
            text?: string;
            error?: string;
          };
          if (!current()) return;
          if (!response.ok)
            throw new Error(data.error ?? "Couldn't transcribe that. Please try again.");
          if (data.text?.trim()) ownCallbacks.onTranscript?.(data.text.trim());
          else
            ownCallbacks.onError?.(
              "No words were recognised. Please try again or type your answer."
            );
        } catch (error) {
          if (current())
            ownCallbacks.onError?.(
              error instanceof Error ? error.message : "Couldn't transcribe that. Please try again."
            );
        } finally {
          if (current()) {
            request.current = null;
            active.current = false;
            setState("idle");
          }
        }
      };
      rec.start();
      setState("recording");
      const startedAt = performance.now();
      clock.current = setInterval(() => setElapsedMs(performance.now() - startedAt), 250);
      timer.current = setTimeout(stop, maxMs);

      // Optional dictation convenience. Interviews do not infer finished thoughts from quiet.
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!autoStop || !Ctx) return;
      const ctx = new Ctx();
      context.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(input).connect(analyser);
      const buffer = new Uint8Array(analyser.fftSize);
      let spoke = false;
      let silenceAt = 0;
      const tick = () => {
        if (!current() || rec.state !== "recording") return;
        analyser.getByteTimeDomainData(buffer);
        const rms = Math.sqrt(
          buffer.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / buffer.length
        );
        const now = performance.now();
        if (rms > 0.018) {
          spoke = true;
          silenceAt = 0;
        } else if (spoke) {
          if (!silenceAt) silenceAt = now;
          else if (now - silenceAt > silenceMs) {
            stop();
            return;
          }
        } else if (now - startedAt > noSpeechMs) {
          cancel();
          ownCallbacks.onError?.("No speech detected. Check your microphone and try again.");
          return;
        }
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    } catch {
      if (current()) {
        cancel();
        ownCallbacks.onError?.("Couldn't start recording. Please try again or type your answer.");
      }
    }
  }, [isSupported, autoStop, maxMs, silenceMs, noSpeechMs, releaseCapture, cancel, stop]);

  useEffect(() => dispose, [dispose]);
  return {
    state: isSupported ? state : ("unsupported" as GroqVoiceState),
    isSupported,
    elapsedMs,
    start,
    stop,
    cancel,
  };
}
