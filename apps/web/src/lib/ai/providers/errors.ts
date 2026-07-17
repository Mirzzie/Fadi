function errInfo(err: unknown) {
  const e = err as { status?: number; code?: string; message?: string } | undefined;
  return { status: e?.status, code: e?.code, msg: e?.message ?? "" };
}

/**
 * True when a provider rejected strict structured-output / json_schema mode (so
 * we should retry with a tolerant JSON approach) — vs a real auth/quota/network
 * error, which must bubble up. Many free/local/OpenRouter models can't do
 * `response_format: json_schema`; they answer with a 400/422 bad-request.
 */
export function isStructuredOutputUnsupported(err: unknown): boolean {
  const { status, code, msg } = errInfo(err);
  // Never treat auth/quota/rate-limit as "unsupported" — those must surface.
  if (status === 401 || status === 403 || status === 429 || code === "insufficient_quota") {
    return false;
  }
  if (status === 400 || status === 404 || status === 422) return true;
  return /response_format|json[_\s]?schema|json mode|structured output|not supported|unsupported|invalid schema/i.test(
    msg,
  );
}

/** Temporary rate limit (requests/tokens-per-minute) — recovers with backoff. */
export function isRateLimited(err: unknown): boolean {
  const { status, code } = errInfo(err);
  return status === 429 && code !== "insufficient_quota";
}

/** Hard, non-recoverable for this provider — retrying won't help; switch away. */
export function isProviderExhausted(err: unknown): boolean {
  const { status, code, msg } = errInfo(err);
  return (
    code === "insufficient_quota" ||
    status === 401 ||
    status === 403 ||
    /quota|billing|invalid api key/i.test(msg)
  );
}

/**
 * Turn a raw provider/SDK error into an honest, actionable message for the user.
 * Never a vague "something went wrong" — name the real cause so they can fix it.
 */
export function aiErrorMessage(
  err: unknown,
  provider?: { id?: string; name?: string },
): string {
  const e = err as { status?: number; code?: string; message?: string } | undefined;
  const status = e?.status;
  const code = e?.code;
  const msg = e?.message ?? "";
  const who = provider?.name ?? "Your AI provider";

  if (status === 401 || code === "invalid_api_key" || /api key/i.test(msg)) {
    return `${who} rejected the API key (invalid or revoked). Update it in Settings → AI provider.`;
  }
  // OpenRouter free models fail with a "no endpoints" / data-policy error that
  // can ride in on a 429 — catch it before the generic quota branch so the user
  // gets the real fix (the privacy toggle), not a billing message.
  if (/data policy|no endpoints|no allowed providers/i.test(msg)) {
    return "OpenRouter is blocking free (:free) models for this account. Enable them at openrouter.ai/settings/privacy (turn on 'Free model publication / prompt training'), then try again.";
  }
  if (status === 429 || code === "insufficient_quota" || /quota|billing/i.test(msg)) {
    // The #1 confusion, and it hits BOTH big paid providers: a consumer chat
    // subscription is not the same account as API access. A Claude Pro/Max plan
    // (claude.ai) and a ChatGPT Plus plan (chatgpt.com) grant neither API credits
    // nor an API key — those live at the separate developer consoles and are billed
    // pay-as-you-go. So a "rate limit / quota" error on a key from one of these
    // accounts almost always means "this account has no API credits", not "slow down".
    if (provider?.id === "openai") {
      return "OpenAI rejected this key for quota. A ChatGPT Plus/Pro subscription is NOT API access — they're separate accounts. Add pay-as-you-go credit at platform.openai.com → Billing (or use Groq, which has a genuinely free API tier).";
    }
    if (provider?.id === "anthropic") {
      return "Anthropic rejected this key for quota. A Claude Pro/Max subscription (claude.ai) is NOT API access — the API is a separate, pay-as-you-go account. Add credit at console.anthropic.com → Billing, or use Groq, which has a genuinely free API tier.";
    }
    if (provider?.id === "google") {
      return "Gemini's free quota was exceeded. Use the gemini-2.0-flash model (the most generous free tier — avoid gemini-2.5-pro, which has almost no free quota), or wait a minute and retry.";
    }
    if (provider?.id === "groq") {
      return "Groq's free daily token limit was hit. Switch to a smaller model (llama-3.1-8b-instant has its own daily quota), add a fallback provider in Settings, or wait for the daily reset.";
    }
    return `${who} is out of quota or rate-limited. Add credits/billing to that account, or switch providers in Settings.`;
  }
  if (status === 404 || /model/i.test(msg)) {
    return `The selected model isn't available for this key on ${who}. Pick a different model in Settings → AI provider.`;
  }
  if (status === 403) {
    return `${who} denied access (permissions or region). Check the account or try another provider.`;
  }
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|timeout/i.test(msg)) {
    return `Couldn't reach ${who}. If you're using a local model (Ollama), make sure it's running.`;
  }
  return `Fadi couldn't reach ${who}. Please try again in a moment.`;
}
