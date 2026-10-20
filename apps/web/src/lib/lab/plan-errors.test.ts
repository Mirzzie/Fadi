import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every planning failure used to say "Couldn't plan this one just now — try again in a
 * moment". Driving the hub showed the real cause was Groq's free tier returning 429 on
 * tokens-per-minute — and the same sentence was shown for failures retrying can never fix.
 */

const structured = vi.fn();

vi.mock("@/lib/ai/user-generate", async () => {
  class AiRateLimitError extends Error {
    constructor() {
      super("That's a lot of drafting in one go — your AI allowance resets in about 12 minutes. Nothing is lost.");
    }
  }
  return {
    AiRateLimitError,
    getUserDocGenerate: async () => ({ structured, text: vi.fn() }),
  };
});
vi.mock("@/lib/database/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@careeros/database", () => ({
  createLabResourcesRepository: () => ({ listForUser: async () => [] }),
  createProjectRunsRepository: () => ({}),
}));

beforeEach(() => {
  structured.mockReset();
});

async function plan() {
  const { planProjectRun } = await import("./plan-run");
  return planProjectRun("u1", { title: "Nginx reverse proxy", detail: "TLS on Linux" });
}

describe("a planning failure says which failure it was", () => {
  it("THE REAL ONE: a provider rate limit says so, and names the fix", async () => {
    structured.mockRejectedValue(
      new Error("429 Rate limit reached for model `openai/gpt-oss-120b` on tokens per minute (TPM)"),
    );
    const res = await plan();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toMatch(/rate-limited/i);
      // The thing that would have prevented it, which the old message hid.
      expect(res.message).toMatch(/fallback provider/i);
    }
  });

  it("a rejected key says retrying won't help", async () => {
    structured.mockRejectedValue(new Error("401 Invalid API key"));
    const res = await plan();
    if (!res.ok) expect(res.message).toMatch(/won't help/i);
  });

  it("passes Fadi's own allowance message through rather than flattening it", async () => {
    const { AiRateLimitError } = await import("@/lib/ai/user-generate");
    structured.mockRejectedValue(new (AiRateLimitError as unknown as new () => Error)());
    const res = await plan();
    if (!res.ok) expect(res.message).toMatch(/allowance resets/);
  });

  it("anything else does NOT claim a moment's wait will fix it", async () => {
    structured.mockRejectedValue(new Error("Unexpected token in JSON"));
    const res = await plan();
    if (!res.ok) {
      expect(res.message).not.toMatch(/just now/i);
      expect(res.message).toMatch(/usable plan/);
    }
  });
});
