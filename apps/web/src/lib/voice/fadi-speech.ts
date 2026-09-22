/**
 * The single source of truth for "Fadi is speaking". One controller owns every
 * speech path so the living core/orb react no matter what triggered it:
 *  1. Premium neural TTS via /api/fadi/speak (Groq/OpenAI) — played as audio.
 *  2. Browser speechSynthesis fallback (male voice) when no cloud key is set or
 *     the request fails — so Fadi always has a voice.
 * Subscribers (useSpeechOutput, FadiPresence) get notified on start/stop.
 */

type Listener = (speaking: boolean) => void;

let audioEl: HTMLAudioElement | null = null;
let speaking = false;
let generation = 0;
let pendingSpeech: AbortController | null = null;
let releaseAudio: (() => void) | null = null;
const listeners = new Set<Listener>();

// Once the cloud TTS endpoint returns a hard failure (no/expired key → 503), stop
// hitting it on every utterance — flip to the browser voice for the rest of the session.
let cloudTtsDown = false;
// Warn exactly once when the platform has no speech voice at all (common on Linux).
let warnedNoVoices = false;
let warnedAutoplay = false;
/** Did the browser refuse to play BEFORE a gesture, rather than fail to play at all? */
export function isAutoplayBlock(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "AbortError")
  );
}

/**
 * Audio the browser refused to play before a gesture.
 *
 * It holds the ELEMENT, not the text: retrying by calling speakFadi again threw away a blob we
 * had already generated and paid a second provider request for it (Codex C15-07). It also carries
 * the generation that asked for it, so Stop, mute, a new utterance or an unmounted interview
 * cancel it instead of leaving it to surprise the person on their next click.
 */
let queuedByAutoplay: {
  at: number;
  generation: number;
  el: HTMLAudioElement;
  release: () => void;
} | null = null;
let gestureListener: (() => void) | null = null;

/**
 * Hold a blocked utterance until the person touches the page.
 *
 * One page load, one retry, and only while it is still current: a briefing that arrives on load
 * should be read when they engage, not thirty minutes later over something else.
 */
const GESTURE_WINDOW_MS = 60_000;

/** Forget anything waiting on a gesture, and free what it was holding. */
function clearQueuedSpeech(): void {
  if (gestureListener && typeof window !== "undefined") {
    window.removeEventListener("pointerdown", gestureListener);
    window.removeEventListener("keydown", gestureListener);
  }
  gestureListener = null;
  const queued = queuedByAutoplay;
  queuedByAutoplay = null;
  if (!queued) return;
  queued.el.pause();
  queued.release();
}

function waitForGesture(el: HTMLAudioElement, release: () => void, ownGeneration: number): void {
  clearQueuedSpeech();
  queuedByAutoplay = { at: Date.now(), generation: ownGeneration, el, release };
  if (!warnedAutoplay) {
    warnedAutoplay = true;
    console.info(
      "[Fadi] The browser holds audio until you interact with the page — Fadi will speak on your next click."
    );
  }
  if (typeof window === "undefined") return;
  const go = () => {
    const queued = queuedByAutoplay;
    if (gestureListener) {
      window.removeEventListener("pointerdown", gestureListener);
      window.removeEventListener("keydown", gestureListener);
    }
    gestureListener = null;
    queuedByAutoplay = null;
    if (!queued) return;
    // Stale in any of three ways: superseded, stopped, or simply too old to still be what the
    // person expects to hear.
    if (queued.generation !== generation || Date.now() - queued.at > GESTURE_WINDOW_MS) {
      queued.el.pause();
      queued.release();
      return;
    }
    audioEl = queued.el;
    releaseAudio = queued.release;
    void queued.el.play().catch(() => {
      queued.release();
      if (audioEl === queued.el) audioEl = null;
    });
  };
  gestureListener = go;
  window.addEventListener("pointerdown", go);
  window.addEventListener("keydown", go);
}
/** The provider's own explanation for refusing the premium voice, when it gave one. */
let cloudTtsReason: string | null = null;

function emit(next: boolean) {
  if (next === speaking) return;
  speaking = next;
  for (const l of listeners) l(next);
}

export function subscribeFadiSpeaking(cb: Listener): () => void {
  listeners.add(cb);
  cb(speaking);
  return () => {
    listeners.delete(cb);
  };
}

export function isFadiSpeaking(): boolean {
  return speaking;
}

/** Whether the user has turned Fadi's voice on (the menu-bar / chat mute toggle). */
export function isFadiVoiceEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("fadi-voice-enabled") === "1";
}

export function stopFadiSpeech(): void {
  // Stop owns generation too: an old network response must not restart a question.
  generation += 1;
  pendingSpeech?.abort();
  pendingSpeech = null;
  if (audioEl) {
    audioEl.pause();
    audioEl.src = "";
    audioEl = null;
  }
  releaseAudio?.();
  releaseAudio = null;
  // Stop means stop: speech waiting on a gesture is cancelled too, not saved for the next click.
  clearQueuedSpeech();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  emit(false);
}

// ── Browser fallback voice selection (male, natural English) ────────────────
const MALE_VOICE_HINT =
  /\b(male|guy|christopher|eric|brian|davis|tony|jason|david|mark|daniel|alex|fred|aaron|arthur|oliver|rishi|tom|james|john|matthew|ryan|roger|steffan|reed|gordon|george|liam)\b/i;
const NATURAL_VOICE_HINT = /natural|neural|enhanced|online|premium|siri|wavenet/i;

function pickMaleVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return undefined;
  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const pool = en.length > 0 ? en : voices;
  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    if (MALE_VOICE_HINT.test(v.name)) s += 5;
    if (NATURAL_VOICE_HINT.test(v.name)) s += 2;
    if (/^en-(us|gb)/i.test(v.lang)) s += 1;
    return s;
  };
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}

function browserFallback(text: string, ownGeneration: number) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickMaleVoice();
  if (voice) {
    utterance.voice = voice;
  } else if (!warnedNoVoices && window.speechSynthesis.getVoices().length === 0) {
    // No system voice at all — the browser will make no sound. Say why, once, and lead with the
    // provider's reason when there is one: "install espeak" is useless advice to someone whose
    // cloud voice is one click from working.
    warnedNoVoices = true;
    console.warn(
      cloudTtsReason
        ? `[Fadi] Fadi can't speak aloud. The premium voice was refused — ${cloudTtsReason} — and this machine has no system voice as a fallback (on Linux: \`sudo pacman -S speech-dispatcher espeak-ng\`, then restart the browser).`
        : "[Fadi] No system text-to-speech voice is available, so Fadi can't speak aloud. " +
            "On Linux, install a speech engine (e.g. `sudo pacman -S speech-dispatcher espeak-ng`) " +
            "and restart the browser — or run a local Kokoro voice (FADI_TTS_LOCAL_BASE)."
    );
  }
  utterance.rate = 1.0;
  utterance.onstart = () => {
    if (ownGeneration === generation) emit(true);
  };
  utterance.onend = () => {
    if (ownGeneration === generation) emit(false);
  };
  utterance.onerror = () => {
    if (ownGeneration === generation) emit(false);
  };
  window.speechSynthesis.speak(utterance);
}

/** Speak as Fadi — premium neural voice when available, else the browser voice. */
export async function speakFadi(text: string): Promise<void> {
  const clean = text.trim();
  if (!clean || typeof window === "undefined") return;
  stopFadiSpeech();
  const ownGeneration = generation;

  // Skip the cloud endpoint once it's known-down, so we don't fire a failing request
  // (and log a 503) on every single utterance.
  if (!cloudTtsDown) {
    const controller = new AbortController();
    pendingSpeech = controller;
    try {
      const res = await fetch("/api/fadi/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
        signal: controller.signal,
      });
      if (ownGeneration !== generation) return;
      if (res.ok) {
        const blob = await res.blob();
        if (ownGeneration !== generation) return;
        const url = URL.createObjectURL(blob);
        const el = new Audio(url);
        audioEl = el;
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          URL.revokeObjectURL(url);
          if (audioEl === el) audioEl = null;
          if (releaseAudio === release) releaseAudio = null;
        };
        releaseAudio = release;
        el.onplay = () => {
          if (ownGeneration === generation) emit(true);
        };
        const done = () => {
          release();
          if (ownGeneration === generation) emit(false);
        };
        el.onended = done;
        el.onerror = done;
        try {
          await el.play();
          return;
        } catch (error) {
          // AUTOPLAY, NOT A MISSING VOICE. Chromium refuses sound until the page has had a
          // gesture, so a briefing that speaks on mount can never be heard on a fresh load. The
          // old code fell through to the browser voice and — on a machine with none — blamed the
          // absent Linux speech engine for a policy decision the browser had just made.
          if (ownGeneration !== generation) {
            release();
            return;
          }
          if (!isAutoplayBlock(error)) release();
          if (isAutoplayBlock(error)) {
            // The person already asked for Fadi's voice. The browser is not refusing the voice,
            // only refusing it BEFORE a gesture — so the audio we already generated waits for
            // their next click, rather than being thrown away and re-requested.
            waitForGesture(el, release, ownGeneration);
            emit(false);
            return;
          }
          throw error;
        }
      }
      // A hard non-OK (e.g. 503: no/expired TTS key) means the cloud voice is
      // unavailable this session — don't retry it every time. Keep WHY: the provider's own
      // message is the only thing that tells the person what to do about it, and it used to be
      // thrown away in favour of advice about installing a Linux speech engine.
      cloudTtsDown = true;
      cloudTtsReason = await res
        .json()
        .then((body: { reason?: string; provider?: string }) =>
          body?.reason ? `${body.provider ? `${body.provider}: ` : ""}${body.reason}` : null
        )
        .catch(() => null);
    } catch {
      if (ownGeneration !== generation) return;
      releaseAudio?.();
      // Network error or an autoplay block — fall back this once, but DON'T disable
      // the cloud path (autoplay unlocks after a user gesture; the key may be fine).
    } finally {
      if (pendingSpeech === controller) pendingSpeech = null;
    }
  }
  if (ownGeneration === generation) browserFallback(clean, ownGeneration);
}
