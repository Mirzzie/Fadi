import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ configs: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/user-settings", () => ({ getUserProviderConfigs: mocks.configs }));

/**
 * THE PROVIDER'S ANSWER IS THE ANSWER.
 *
 * Measured on the owner's account: Groq refused every speech request with a 400 that said what to
 * do — accept the model's terms, one click — and the code dropped it on the floor, answered 503
 * "No TTS provider", and the browser advised installing a Linux speech engine. They had been
 * living with a mute Fadi ever since.
 */
describe("synthesizeFadiSpeech", () => {
  beforeEach(() => {
    mocks.configs.mockReset();
    mocks.configs.mockResolvedValue([{ id: "groq", apiKey: "gsk-test" }]);
  });

  const reply = (status: number, body: string) =>
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(body, { status, headers: { "Content-Type": "application/json" } })
    );

  it("carries the provider's own message out of a refusal", async () => {
    const fetchSpy = reply(
      400,
      JSON.stringify({
        error: {
          message:
            "The model `canopylabs/orpheus-v1-english` requires terms acceptance. Please have the org admin accept the terms at https://console.groq.com/playground",
          code: "model_terms_required",
        },
      })
    );
    try {
      const { synthesizeFadiSpeech } = await import("./tts");
      const out = await synthesizeFadiSpeech("user-1", "Hello.");
      expect(out && "failures" in out).toBe(true);
      if (!out || !("failures" in out)) return;
      expect(out.failures[0]).toMatchObject({ provider: "Groq", status: 400 });
      expect(out.failures[0].reason).toContain("requires terms acceptance");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("returns audio when the provider answers with some", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    try {
      const { synthesizeFadiSpeech } = await import("./tts");
      const out = await synthesizeFadiSpeech("user-1", "Hello.");
      expect(out && "audio" in out).toBe(true);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("says nothing was configured when there is no key at all", async () => {
    mocks.configs.mockResolvedValue([{ id: "groq", apiKey: "" }]);
    const { synthesizeFadiSpeech } = await import("./tts");
    expect(await synthesizeFadiSpeech("user-1", "Hello.")).toBeNull();
  });

  it("keeps a non-JSON error readable rather than dropping it", async () => {
    const fetchSpy = reply(502, "upstream timed out");
    try {
      const { synthesizeFadiSpeech } = await import("./tts");
      const out = await synthesizeFadiSpeech("user-1", "Hello.");
      if (!out || !("failures" in out)) throw new Error("expected failures");
      expect(out.failures[0].reason).toBe("upstream timed out");
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe("which failure the person is shown", () => {
  it("prefers the backend that answered over one that could not be reached", async () => {
    // Measured: FADI_TTS_LOCAL_BASE points at a Kokoro server that is not running, so it fails
    // first with "fetch failed" — which would have masked Groq's actual, actionable message.
    mocks.configs.mockResolvedValue([{ id: "groq", apiKey: "gsk-test" }]);
    process.env.FADI_TTS_LOCAL_BASE = "http://localhost:8880/v1";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "requires terms acceptance" } }), {
          status: 400,
        })
      );
    try {
      const { synthesizeFadiSpeech } = await import("./tts");
      const out = await synthesizeFadiSpeech("user-1", "Hello.");
      if (!out || !("failures" in out)) throw new Error("expected failures");
      expect(out.failures).toHaveLength(2);
      expect(out.failures[0].status).toBe(0); // the unreachable local server
      const told = out.failures.find((f) => f.status > 0);
      expect(told?.provider).toBe("Groq");
      expect(told?.reason).toContain("terms acceptance");
    } finally {
      fetchSpy.mockRestore();
      delete process.env.FADI_TTS_LOCAL_BASE;
    }
  });
});
