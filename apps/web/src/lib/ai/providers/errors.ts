function errInfo(err: unknown) {
  const e = err as { status?: number; code?: string; message?: string } | undefined;
  return { status: e?.status, code: e?.code, msg: e?.message ?? "" };
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
export function aiErrorMessage(err: unknown): string {
  const e = err as { status?: number; code?: string; message?: string } | undefined;
  const status = e?.status;
  const code = e?.code;
  const msg = e?.message ?? "";

  if (status === 401 || code === "invalid_api_key" || /api key/i.test(msg)) {
    return "Your AI provider rejected the API key (invalid or revoked). Update it in Settings → AI provider.";
  }
  if (status === 429 || code === "insufficient_quota" || /quota|billing/i.test(msg)) {
    return "Your AI provider is out of quota or rate-limited. A ChatGPT Plus subscription does NOT include API credits — add billing/credits to the API account, or switch providers in Settings.";
  }
  if (status === 404 || /model/i.test(msg)) {
    return "The selected model isn't available for this key. Pick a different model in Settings → AI provider.";
  }
  if (status === 403) {
    return "Your AI provider denied access (permissions or region). Check the account or try another provider.";
  }
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|timeout/i.test(msg)) {
    return "Couldn't reach the AI provider. If you're using a local model (Ollama), make sure it's running.";
  }
  return "Kai couldn't reach the AI provider. Please try again in a moment.";
}
