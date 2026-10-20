#!/usr/bin/env node
/**
 * Make sure the local speech-to-text server has its model.
 *
 * Speaches does not download a model on first use: a fresh volume answers every transcription
 * with 404 "not installed locally", and the app then quietly falls back to a cloud provider —
 * the rate-limited path this setup exists to avoid. This waits for the server and installs the
 * model once. Safe to run every time; an installed model is a no-op.
 */
const base = (process.env.FADI_STT_LOCAL_BASE || "http://localhost:8000/v1").replace(/\/v1\/?$/, "");
const model = process.env.FADI_STT_LOCAL_MODEL || "Systran/faster-whisper-small.en";

async function up() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${base}/health`)).ok) return true;
    } catch {
      /* not listening yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
}

if (!(await up())) {
  console.warn(`voice: speech-to-text server not reachable at ${base}; skipping model install.`);
  process.exit(0);
}
const res = await fetch(`${base}/v1/models/${model}`, { method: "POST" });
console.log(`voice: ${model} — ${res.ok ? "ready" : `install failed (${res.status}): ${await res.text()}`}`);
