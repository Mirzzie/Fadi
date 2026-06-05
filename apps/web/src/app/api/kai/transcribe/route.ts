import { NextRequest } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { createUserProvider } from "@/lib/ai/registry";
import { getUserProviderConfigs } from "@/lib/ai/user-settings";
import { logger } from "@/lib/observability/logger";

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

  // Find the user's Whisper-capable provider (Groq or OpenAI), primary first.
  const configs = await getUserProviderConfigs(user.id);
  const cfg = configs.find((c) => c.id === "groq" || c.id === "openai");
  const provider = cfg ? createUserProvider(cfg) : null;
  if (!provider?.isConfigured || !provider.transcribe) {
    return Response.json(
      { error: "Add a Groq or OpenAI key in Settings → AI provider to use voice." },
      { status: 422 },
    );
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("audio");
    if (f instanceof File && f.size > 0) file = f;
  } catch {
    /* bad form */
  }
  if (!file) return new Response("No audio", { status: 400 });

  try {
    const text = await provider.transcribe(file);
    return Response.json({ text: text.trim() });
  } catch (err) {
    logger.error("kai.transcribe.failed", {
      userId: user.id,
      provider: cfg?.id,
      error: err instanceof Error ? err.message : "unknown",
    });
    return Response.json({ error: "Couldn't transcribe that. Try again." }, { status: 500 });
  }
}
