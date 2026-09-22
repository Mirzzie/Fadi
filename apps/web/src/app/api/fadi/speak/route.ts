import { getCurrentAuthUser } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";
import { consumeAiSpendLimit } from "@/lib/security/ai-spend";
import { synthesizeFadiSpeech } from "@/lib/voice/tts";

/** Fadi's premium voice — neural TTS from the user's Groq/OpenAI key. Returns audio, or a 503
 *  carrying the provider's OWN reason (the client falls back to the browser voice and can say
 *  what actually went wrong instead of guessing). */
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

  const spend = await consumeAiSpendLimit({
    userId: user.id,
    operation: "speech-synthesis",
    perUserLimit: 60,
    globalLimit: 600,
    windowMs: 5 * 60 * 1000,
  });
  if (!spend.allowed) {
    return Response.json(
      { error: "Too much speech generated too quickly.", retryAfterSeconds: spend.retryAfterSeconds },
      { status: 429 },
    );
  }

  try {
    const out = await synthesizeFadiSpeech(user.id, text);
    if (out && "audio" in out) {
      return new Response(out.audio, {
        headers: { "Content-Type": out.contentType, "Cache-Control": "no-store" },
      });
    }

    // SAY WHAT THE PROVIDER SAID. A generic 503 sent the owner to install a Linux speech engine
    // when their cloud voice was one terms-acceptance click from working.
    const failures = out?.failures ?? [];
    if (failures.length > 0) {
      logger.warn("fadi.speak.unavailable", {
        userId: user.id,
        attempts: failures.map((f) => `${f.provider} ${f.status}: ${f.reason}`).join(" | "),
      });
    }
    // THE INFORMATIVE FAILURE, NOT THE FIRST ONE. A local Kokoro server that is configured but
    // not running fails before anything else is tried, and "fetch failed" would have masked the
    // provider that actually answered and said what to do about it.
    const told = failures.find((f) => f.status > 0) ?? failures[0];
    return Response.json(
      {
        error: "no_voice",
        reason:
          told?.reason ??
          "No text-to-speech provider is configured. Add an OpenAI or Groq key in Settings → AI.",
        provider: told?.provider ?? null,
        attempts: failures.length,
      },
      { status: 503 }
    );
  } catch (err) {
    logger.error("fadi.speak.failed", {
      userId: user.id,
      error: err instanceof Error ? err.message : "unknown",
    });
    return new Response("TTS failed", { status: 500 });
  }
}
