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

/** Mean (centroid) of vectors — the "taste" vector for personalization. Null if none. */
export function meanVector(vectors: number[][]): number[] | null {
  const valid = vectors.filter((v) => v.length > 0);
  if (valid.length === 0) return null;
  const dims = valid[0].length;
  const sum = new Array<number>(dims).fill(0);
  for (const v of valid) {
    for (let i = 0; i < dims && i < v.length; i++) sum[i] += v[i];
  }
  for (let i = 0; i < dims; i++) sum[i] /= valid.length;
  return sum;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const cosNorm = (cos: number) => clamp01((cos + 1) / 2);

/**
 * Blend a 0–100 lexical score with up to two cosine signals into a 0–100 score:
 *  - `cos`     — similarity to the user's TARGET ROLE (semantic relevance)
 *  - `prefCos` — similarity to roles they've SAVED/APPLIED to (personalization)
 * Any signal may be null. With only the lexical score (both null) it passes through
 * unchanged, so ranking is identical wherever vectors are missing.
 */
export function fuseScore(
  lexScore: number,
  cos: number | null,
  prefCos: number | null = null,
  lexWeight = 0.55,
): number {
  if (cos == null && prefCos == null) return Math.round(lexScore);
  const lexNorm = clamp01(lexScore / 100);
  if (cos != null && prefCos != null) {
    // 3-signal: relevance leads, taste nudges. (0.45 lex · 0.35 role · 0.20 taste)
    return Math.round(100 * (0.45 * lexNorm + 0.35 * cosNorm(cos) + 0.2 * cosNorm(prefCos)));
  }
  if (cos != null) {
    return Math.round(100 * (lexWeight * lexNorm + (1 - lexWeight) * cosNorm(cos)));
  }
  // Only a taste signal (no role vector yet).
  return Math.round(100 * (0.6 * lexNorm + 0.4 * cosNorm(prefCos as number)));
}

function openaiKey(): string | null {
  const k = process.env.OPENAI_API_KEY?.trim();
  return k ? k : null;
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
