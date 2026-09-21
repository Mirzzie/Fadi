import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const played = vi.fn();
const paused = vi.fn();
const fetchMock = vi.fn();
const revoke = vi.fn();
const created: FakeAudio[] = [];
class FakeAudio {
  src: string;
  onplay: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(src: string) {
    this.src = src;
    created.push(this);
  }
  async play() {
    played(this.src);
    this.onplay?.();
  }
  pause() {
    paused();
  }
}
const ok = () => ({ ok: true, blob: async () => new Blob(["audio"]) });

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  created.length = 0;
  let id = 0;
  vi.stubGlobal("window", {
    speechSynthesis: { cancel: vi.fn(), getVoices: () => [], speak: vi.fn() },
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Audio", FakeAudio);
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:audio-${++id}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(revoke);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("speech interruption owns pending generation as well as playback", () => {
  it("does not play a question whose generation completes after Stop", async () => {
    const pending = deferred<ReturnType<typeof ok>>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const speech = await import("./fadi-speech");
    const work = speech.speakFadi("Old question");
    speech.stopFadiSpeech();
    pending.resolve(ok());
    await work;
    expect(played).not.toHaveBeenCalled();
    expect(speech.isFadiSpeaking()).toBe(false);
  });

  it("only the latest question plays when responses arrive out of order", async () => {
    const old = deferred<ReturnType<typeof ok>>();
    fetchMock.mockReturnValueOnce(old.promise).mockResolvedValueOnce(ok());
    const speech = await import("./fadi-speech");
    const first = speech.speakFadi("First question");
    await speech.speakFadi("Second question");
    old.resolve(ok());
    await first;
    expect(played).toHaveBeenCalledTimes(1);
    expect(speech.isFadiSpeaking()).toBe(true);
  });

  it("cancels the pending request on Stop", async () => {
    const pending = deferred<ReturnType<typeof ok>>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const speech = await import("./fadi-speech");
    const work = speech.speakFadi("Question");
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    speech.stopFadiSpeech();
    pending.resolve(ok());
    await work;
    expect(signal?.aborted).toBe(true);
  });

  it("releases stopped audio and ignores its late completion event", async () => {
    fetchMock.mockResolvedValue(ok());
    const speech = await import("./fadi-speech");
    await speech.speakFadi("First");
    const oldEnd = created[0].onended;
    await speech.speakFadi("Second");
    expect(paused).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:audio-1");
    oldEnd?.();
    expect(speech.isFadiSpeaking()).toBe(true);
  });
});
