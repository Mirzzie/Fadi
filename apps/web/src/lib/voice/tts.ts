import "server-only";

import { getUserProviderConfigs } from "@/lib/ai/user-settings";

/**
 * Premium neural TTS for Fadi's voice. Uses the user's own Groq or OpenAI key
 * (both expose the OpenAI-compatible /audio/speech endpoint) so Fadi sounds like
 * a real assistant, not the robotic browser voice. Returns null when no capable
 * key is set — the client then falls back to the browser voice, so nothing breaks.
 */

type TtsSpec = {
  base: string;
  model: string;
  voice: string;
  format: string;
  contentType: string;
  apiKey: string;
};

/**
 * Local, keyless, OpenAI-compatible TTS (Kokoro-FastAPI, default :8880). Preferred
 * when FADI_TTS_LOCAL_BASE is set — fully local, $0, and it needs NO system voice,
 * so it's the fix for machines with none (e.g. Linux without speech-dispatcher).
 */
function localSpec(): TtsSpec | null {
  const base = process.env.FADI_TTS_LOCAL_BASE?.trim();
  if (!base) return null;
  return {
    base,
    model: process.env.FADI_TTS_LOCAL_MODEL || "kokoro",
    voice: process.env.FADI_TTS_LOCAL_VOICE || "am_michael", // warm male Kokoro voice
    format: "mp3",
    contentType: "audio/mpeg",
    apiKey: "local", // Kokoro-FastAPI ignores auth; the header just needs to exist.
  };
}

function specFor(id: string): Omit<TtsSpec, "apiKey"> | null {
  if (id === "openai") {
    return {
      base: "https://api.openai.com/v1",
      model: process.env.FADI_TTS_OPENAI_MODEL || "tts-1",
      voice: process.env.FADI_TTS_OPENAI_VOICE || "onyx", // deep, male
      format: "mp3",
      contentType: "audio/mpeg",
    };
  }
  if (id === "groq") {
    return {
      base: "https://api.groq.com/openai/v1",
      model: process.env.FADI_TTS_GROQ_MODEL || "canopylabs/orpheus-v1-english",
      voice: process.env.FADI_TTS_GROQ_VOICE || "troy", // Orpheus voice
      format: "wav",
      contentType: "audio/wav",
    };
  }
  return null;
}

/**
 * WHY IT DIDN'T SPEAK, IN THE PROVIDER'S OWN WORDS.
 *
 * Every backend failure used to be swallowed by `continue`, so the route answered 503 "No TTS
 * provider" and the browser logged advice about installing a Linux speech engine. Measured on the
 * owner's account (22 Sep 2026), the real answer had been sitting in a discarded 400:
 *
 *   "The model `canopylabs/orpheus-v1-english` requires terms acceptance. Please have the org
 *    admin accept the terms at https://console.groq.com/playground?model=…"
 *
 * One click away, and the person was told to install espeak instead. A provider that explains
 * itself deserves to be quoted.
 */
export type SpeechFailure = { provider: string; status: number; reason: string };

export async function synthesizeFadiSpeech(
  userId: string,
  text: string
): Promise<
  { audio: ArrayBuffer; contentType: string } | { failures: SpeechFailure[] } | null
> {
  const input = text.trim().slice(0, 1200); // keep requests snappy
  if (!input) return null;

  // Ordered backends to try. Local Kokoro first (when configured): local, $0, and
  // works with no system voice. Then the user's own cloud key(s), if any.
  const specs: TtsSpec[] = [];
  const local = localSpec();
  if (local) specs.push(local);

  const configs = await getUserProviderConfigs(userId);
  for (const cfg of configs) {
    if ((cfg.id === "openai" || cfg.id === "groq") && cfg.apiKey) {
      const spec = specFor(cfg.id);
      if (spec) specs.push({ ...spec, apiKey: cfg.apiKey });
    }
  }

  const failures: SpeechFailure[] = [];
  for (const spec of specs) {
    try {
      const res = await fetch(`${spec.base}/audio/speech`, {
        method: "POST",
        headers: { Authorization: `Bearer ${spec.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: spec.model,
          voice: spec.voice,
          input,
          response_format: spec.format,
        }),
        signal: AbortSignal.timeout(30000), // local CPU TTS can be a touch slower than cloud
      });
      if (!res.ok) {
        failures.push({
          provider: spec.base.includes("groq") ? "Groq" : spec.base.includes("openai") ? "OpenAI" : "local",
          status: res.status,
          reason: readReason(await res.text().catch(() => "")),
        });
        continue;
      }
      const audio = await res.arrayBuffer();
      if (audio.byteLength > 0) return { audio, contentType: spec.contentType };
      failures.push({ provider: spec.model, status: 200, reason: "returned no audio" });
    } catch (error) {
      failures.push({
        provider: spec.model,
        status: 0,
        reason: error instanceof Error ? error.message : "could not be reached",
      });
    }
  }
  return failures.length > 0 ? { failures } : null;
}

/** The provider's message, not its JSON envelope. */
function readReason(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    const message = parsed.error?.message;
    if (typeof message === "string" && message.trim()) return message.trim().slice(0, 400);
  } catch {
    /* not JSON */
  }
  return body.trim().slice(0, 200) || "no reason given";
}
