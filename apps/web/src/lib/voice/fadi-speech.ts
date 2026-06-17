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
const listeners = new Set<Listener>();

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

export function stopFadiSpeech(): void {
  if (audioEl) {
    audioEl.pause();
    audioEl.src = "";
    audioEl = null;
  }
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

function browserFallback(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickMaleVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = 1.0;
  utterance.onstart = () => emit(true);
  utterance.onend = () => emit(false);
  utterance.onerror = () => emit(false);
  window.speechSynthesis.speak(utterance);
}

/** Speak as Fadi — premium neural voice when available, else the browser voice. */
export async function speakFadi(text: string): Promise<void> {
  const clean = text.trim();
  if (!clean || typeof window === "undefined") return;
  stopFadiSpeech();

  try {
    const res = await fetch("/api/fadi/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean }),
    });
    if (res.ok) {
      const url = URL.createObjectURL(await res.blob());
      const el = new Audio(url);
      audioEl = el;
      el.onplay = () => emit(true);
      const done = () => {
        emit(false);
        URL.revokeObjectURL(url);
        if (audioEl === el) audioEl = null;
      };
      el.onended = done;
      el.onerror = done;
      await el.play(); // may reject if autoplay isn't unlocked → fall through
      return;
    }
  } catch {
    /* no cloud key, network error, or autoplay block → browser voice */
  }
  browserFallback(clean);
}
