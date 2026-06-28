/**
 * Text embeddings + vector math for hybrid (semantic + lexical) job search.
 *
 * `cosine` / `fuseScore` are pure and import-safe anywhere. `embedText` /
 * `embedTexts` are best-effort: they return null when no embeddings provider is
 * configured (or the call fails), so every caller degrades to lexical-only
 * behaviour and the board never breaks. Operator-level key for now (one key embeds
 * all jobs + queries); per-user BYO embedding keys can come later.
 */

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;

const ENDPOINT = "https://api.openai.com/v1/embeddings";
const FETCH_TIMEOUT_MS = 8000;
const MAX_BATCH = 96;
const MAX_CHARS = 8000; // ~2k tokens — plenty for title + company + a JD snippet

/** Cosine similarity of two equal-length vectors; 0 when either is empty/zero. */
export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Blend a 0–100 lexical score with a cosine (−1..1) into a 0–100 final score.
 * With no vector (cos == null) the lexical score passes through unchanged, so
 * ranking is identical to today wherever embeddings are missing.
 */
export function fuseScore(lexScore: number, cos: number | null, lexWeight = 0.55): number {
  if (cos == null) return Math.round(lexScore);
  const lexNorm = Math.max(0, Math.min(1, lexScore / 100));
  const cosNorm = Math.max(0, Math.min(1, (cos + 1) / 2));
  const semWeight = 1 - lexWeight;
  return Math.round(100 * (lexWeight * lexNorm + semWeight * cosNorm));
}

function openaiKey(): string | null {
  const k = process.env.OPENAI_API_KEY?.trim();
  return k ? k : null;
}

/** Whether semantic features can run at all (an embeddings key is present). */
export function hasEmbeddingsProvider(): boolean {
  return openaiKey() != null;
}

/** Embed many texts; element is null where that input couldn't be embedded. */
export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  const key = openaiKey();
  if (!key || texts.length === 0) return texts.map(() => null);
  const out: (number[] | null)[] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const batch = texts.slice(i, i + MAX_BATCH).map((t) => (t.trim() || " ").slice(0, MAX_CHARS));
    out.push(...(await embedBatch(batch, key)));
  }
  return out;
}

/** Embed one text; null when no provider or the call fails. */
export async function embedText(text: string): Promise<number[] | null> {
  const [v] = await embedTexts([text]);
  return v ?? null;
}

async function embedBatch(input: string[], key: string): Promise<(number[] | null)[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
    });
    if (!res.ok) return input.map(() => null);
    const json = (await res.json()) as { data?: Array<{ embedding: number[]; index: number }> };
    const byIndex = new Map((json.data ?? []).map((d) => [d.index, d.embedding]));
    return input.map((_, i) => byIndex.get(i) ?? null);
  } catch {
    return input.map(() => null);
  } finally {
    clearTimeout(timer);
  }
}
