import "server-only";

import { getUserProviderConfigs } from "@/lib/ai/user-settings";

/**
 * Premium neural TTS for Fadi's voice. Uses the user's own Groq or OpenAI key
 * (both expose the OpenAI-compatible /audio/speech endpoint) so Fadi sounds like
 * a real assistant, not the robotic browser voice. Returns null when no capable
 * key is set — the client then falls back to the browser voice, so nothing breaks.
 */

type TtsSpec = { base: string; model: string; voice: string; format: string; contentType: string };

function specFor(id: string): TtsSpec | null {
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
      model: process.env.FADI_TTS_GROQ_MODEL || "playai-tts",
      voice: process.env.FADI_TTS_GROQ_VOICE || "Fritz-PlayAI", // male PlayAI voice
      format: "wav",
      contentType: "audio/wav",
    };
  }
  return null;
}

export async function synthesizeFadiSpeech(
  userId: string,
  text: string,
): Promise<{ audio: ArrayBuffer; contentType: string } | null> {
  const input = text.trim().slice(0, 1200); // keep requests snappy
  if (!input) return null;

  // The user's configured providers, primary first; only the TTS-capable ones.
  const configs = await getUserProviderConfigs(userId);
  const candidates = configs.filter((c) => (c.id === "openai" || c.id === "groq") && c.apiKey);

  for (const cfg of candidates) {
    const spec = specFor(cfg.id);
    if (!spec) continue;
    try {
      const res = await fetch(`${spec.base}/audio/speech`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: spec.model, voice: spec.voice, input, response_format: spec.format }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) continue;
      const audio = await res.arrayBuffer();
      if (audio.byteLength > 0) return { audio, contentType: spec.contentType };
    } catch {
      // try the next provider
    }
  }
  return null;
}
