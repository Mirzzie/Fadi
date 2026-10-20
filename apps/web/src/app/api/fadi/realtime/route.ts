import { getCurrentAuthUser } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/observability/logger";

/**
 * Real-time voice session broker (OpenAI Realtime API, WebRTC).
 *
 * The browser must NEVER hold the real OpenAI key. This route mints a short-lived
 * EPHEMERAL client secret server-side; the client uses only that to open its WebRTC
 * peer connection directly to OpenAI. Server-side VAD ("server_vad") gives natural
 * turn-taking + barge-in without the app timing pauses itself.
 *
 * GET  → { configured } so the UI can show the live-voice option only when a key is set.
 * POST → { clientSecret, model, expiresAt } — an ephemeral token, per session.
 */

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime";
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE?.trim() || "ash"; // a warm male voice

// Voice persona — deliberately SHORTER + more conversational than the text system
// prompt: spoken answers must be brief, plain, and human, or they drag.
const VOICE_INSTRUCTIONS = `You are Fadi, the user's honest career mentor — spoken, in real time.
Talk like a real person on a call: warm, direct, concise. Usually 1–3 sentences; never a monologue.
Be the honest mirror — if something is off their direction or out of reach, say so kindly and offer the better move.
Ground advice in what they actually tell you; never invent facts, numbers, or job details.
Ask one focused question at a time. It's fine to think out loud briefly. If you don't know, say so.`;

export async function GET() {
  return Response.json({ configured: Boolean(serverEnv.OPENAI_API_KEY) });
}

export async function POST() {
  const user = await getCurrentAuthUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const key = serverEnv.OPENAI_API_KEY;
  if (!key) {
    return Response.json(
      { error: "Real-time voice needs an OpenAI key (OPENAI_API_KEY) on the server." },
      { status: 503 },
    );
  }

  try {
    const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: REALTIME_MODEL,
        voice: REALTIME_VOICE,
        instructions: VOICE_INSTRUCTIONS,
        // Natural turn-taking + interruption, handled by the model's VAD.
        turn_detection: { type: "server_vad", silence_duration_ms: 600 },
        // Live captions of what the USER says (Whisper).
        input_audio_transcription: { model: "whisper-1" },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      logger.error("fadi.realtime.session_failed", { status: res.status, detail: detail.slice(0, 300) });
      return Response.json({ error: "Couldn't start a real-time voice session." }, { status: 502 });
    }

    const session = (await res.json()) as {
      client_secret?: { value?: string; expires_at?: number };
    };
    const clientSecret = session.client_secret?.value;
    if (!clientSecret) {
      return Response.json({ error: "Voice session returned no token." }, { status: 502 });
    }

    return Response.json({
      clientSecret,
      model: REALTIME_MODEL,
      expiresAt: session.client_secret?.expires_at ?? null,
    });
  } catch (error) {
    logger.error("fadi.realtime.session_error", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ error: "Couldn't reach the voice service." }, { status: 502 });
  }
}
