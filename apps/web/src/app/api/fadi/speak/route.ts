import { getCurrentAuthUser } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";
import { synthesizeFadiSpeech } from "@/lib/voice/tts";

/** Fadi's premium voice — neural TTS from the user's Groq/OpenAI key. Returns
 *  audio, or 503 when no capable key is set (the client falls back to the browser
 *  voice, so Fadi always speaks). */
export async function POST(req: Request) {
  const user = await getCurrentAuthUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let text = "";
  try {
    const body = (await req.json()) as { text?: unknown };
    if (typeof body.text === "string") text = body.text;
  } catch {
    /* bad body */
  }
  if (!text.trim()) return new Response("No text", { status: 400 });

  try {
    const out = await synthesizeFadiSpeech(user.id, text);
    if (!out) return new Response("No TTS provider", { status: 503 });
    return new Response(out.audio, {
      headers: { "Content-Type": out.contentType, "Cache-Control": "no-store" },
    });
  } catch (err) {
    logger.error("fadi.speak.failed", {
      userId: user.id,
      error: err instanceof Error ? err.message : "unknown",
    });
    return new Response("TTS failed", { status: 500 });
  }
}
