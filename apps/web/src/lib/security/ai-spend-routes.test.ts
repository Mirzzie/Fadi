import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  decision: vi.fn(),
  extract: vi.fn(),
  speak: vi.fn(),
}));

vi.mock("@/lib/security/ai-spend", () => ({ consumeAiSpendLimit: mocks.decision }));
vi.mock("@/lib/auth/session", () => ({ getCurrentAuthUser: async () => ({ id: "u1" }) }));
vi.mock("@/lib/extension/auth", () => ({ getExtensionUser: async () => ({ id: "u1" }) }));
vi.mock("@/lib/env.server", () => ({ serverEnv: { OPENAI_API_KEY: "test-key" } }));
vi.mock("@/lib/database/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/data-sources/providers/fadi-scraper/ai-extract", () => ({
  aiExtractJobs: mocks.extract,
}));
vi.mock("@/lib/voice/tts", () => ({ synthesizeFadiSpeech: mocks.speak }));
vi.mock("@careeros/database", () => ({
  createJobsRepository: () => ({ upsertSeedJob: vi.fn() }),
  createSavedJobsRepository: () => ({ saveForUser: vi.fn() }),
}));

beforeEach(() => {
  mocks.decision.mockReset();
  mocks.extract.mockReset();
  mocks.speak.mockReset();
  mocks.decision.mockResolvedValue({ allowed: false, retryAfterSeconds: 30, scope: "user" });
  vi.stubGlobal("fetch", vi.fn());
});

describe("AI-spending routes stop before their provider boundary", () => {
  it("F05: extension fallback returns 429 without invoking server-default AI", async () => {
    const { POST } = await import("@/app/api/extension/capture-batch/route");
    const request = new Request("https://fadi.test/api/extension/capture-batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobs: [], pageText: "a rendered job board page" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(mocks.decision).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", operation: "extension-job-extraction" }),
    );
    expect(mocks.extract).not.toHaveBeenCalled();
  });

  it("F05: realtime session minting returns 429 without contacting OpenAI", async () => {
    const { POST } = await import("@/app/api/fadi/realtime/route");

    const response = await POST();

    expect(response.status).toBe(429);
    expect(mocks.decision).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", operation: "realtime-session" }),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("also gates speech before selecting a local or cloud synthesizer", async () => {
    const { POST } = await import("@/app/api/fadi/speak/route");
    const request = new Request("https://fadi.test/api/fadi/speak", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Read this" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(mocks.speak).not.toHaveBeenCalled();
  });
});
