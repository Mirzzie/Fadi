import { beforeEach, describe, expect, it, vi } from "vitest";

const cache = vi.hoisted(() => new Map<string, string>());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/security/url-guard", () => ({
  isSafeFetchUrl: async () => true,
  fetchSafeUrl: async (url: string, init?: RequestInit) =>
    fetch(url, { ...init, redirect: "manual" }),
}));
vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/kv/store", () => ({
  getKv: () => ({
    get: async (key: string) => cache.get(key) ?? null,
    set: async (key: string, value: string) => {
      cache.set(key, value);
    },
  }),
}));

beforeEach(() => {
  cache.clear();
  vi.unstubAllGlobals();
});

describe("bounded liveness response reading", () => {
  it("F10: cancels after the byte cap rather than buffering the full body", async () => {
    const { readBodyPrefix } = await import("./liveness");
    const encoder = new TextEncoder();
    let cancelled = false;
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(encoder.encode("x".repeat(16 * 1024)));
      },
      cancel() {
        cancelled = true;
      },
    });

    const prefix = await readBodyPrefix(body, 24 * 1024);

    expect(prefix).toHaveLength(24 * 1024);
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThanOrEqual(3);
  });

  it("the actual liveness probe reads the stream and never calls arrayBuffer", async () => {
    const response = new Response("This job is no longer available" + "x".repeat(100_000), {
      status: 200,
    });
    const arrayBuffer = vi.spyOn(response, "arrayBuffer");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response)
    );
    const { checkPostingLiveness } = await import("./liveness");

    const result = await checkPostingLiveness("https://jobs.example.test/1");

    expect(result.state).toBe("closed");
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
});
