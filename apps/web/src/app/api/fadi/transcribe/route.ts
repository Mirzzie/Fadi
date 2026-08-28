import { NextRequest } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { createUserProvider } from "@/lib/ai/registry";
import { getUserProviderConfigs } from "@/lib/ai/user-settings";
import { logger } from "@/lib/observability/logger";
import { consumeRateLimit } from "@/lib/security/rate-limit";

/** Whisper (Groq/OpenAI) rejects anything over 25 MB — fail fast before forwarding. */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/**
 * Server-side speech-to-text via Whisper (Groq free tier / OpenAI). Browser-
 * agnostic — replaces the flaky Web Speech API which depends on Google's
 * backend (and fails on Linux Chromium / Brave). Uses the user's own key.
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const user = await getCurrentAuthUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Dictation calls this per field, so it's bursty by design — but each call is a
  // Whisper request on the user's key and reads the upload into memory, neither of
  // which passes through getUserDocGenerate's limiter. Generous ceiling, hard stop.
  const rate = await consumeRateLimit({
    key: `transcribe:${user.id}`,
    limit: 60,
    windowMs: 5 * 60 * 1000,
  });
  if (!rate.allowed) {
    return Response.json({ error: "Too much dictation too fast — pause a moment and continue." }, { status: 429 });
  }

  // Read + validate the audio upload first.
  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("audio");
    if (f instanceof File && f.size > 0) file = f;
  } catch {
    /* bad form */
  }
  if (!file) return new Response("No audio", { status: 400 });
  // Reject oversize uploads before they're forwarded (or held in memory) — Whisper
  // would 400 anyway, but bounding it here protects our own process.
  if (file.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "That recording is too long — keep dictation to short takes." }, { status: 413 });
  }

  // Prefer a local, keyless Whisper server (faster-whisper) when configured — fully
  // local, $0, and works on Linux where the browser speech API doesn't.
  const localBase = process.env.FADI_STT_LOCAL_BASE?.trim();
  if (localBase) {
    try {
      const text = await transcribeLocal(file, localBase);
      return Response.json({ text });
    } catch (err) {
      logger.error("fadi.transcribe.local_failed", {
        userId: user.id,
        error: err instanceof Error ? err.message : "unknown",
      });
      // fall through to the user's cloud key, if they have one
    }
  }

  // Cloud fallback — the user's own Whisper-capable provider (Groq/OpenAI).
  const configs = await getUserProviderConfigs(user.id);
  const cfg = configs.find((c) => c.id === "groq" || c.id === "openai");
  const provider = cfg ? createUserProvider(cfg) : null;
  if (!provider?.isConfigured || !provider.transcribe) {
    return Response.json(
      { error: "Voice needs a local Whisper server (FADI_STT_LOCAL_BASE) or a Groq/OpenAI key in Settings." },
      { status: 422 },
    );
  }
  try {
    const text = await provider.transcribe(file);
    return Response.json({ text: text.trim() });
  } catch (err) {
    logger.error("fadi.transcribe.failed", {
      userId: user.id,
      provider: cfg?.id,
      error: err instanceof Error ? err.message : "unknown",
    });
    return Response.json({ error: "Couldn't transcribe that. Try again." }, { status: 500 });
  }
}

/** Transcribe via a local, keyless OpenAI-compatible Whisper server (faster-whisper). */
async function transcribeLocal(file: File, base: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file, file.name || "audio.webm");
  fd.append("model", process.env.FADI_STT_LOCAL_MODEL || "Systran/faster-whisper-small.en");
  fd.append("response_format", "json");
  const res = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    body: fd,
    signal: AbortSignal.timeout(60000), // CPU transcription can take a few seconds
  });
  if (!res.ok) throw new Error(`local whisper ${res.status}`);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}
