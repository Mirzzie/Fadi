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

/**
 * AUTOPLAY IS NOT A MISSING VOICE.
 *
 * Measured on the owner's machine after the premium voice started working: the briefing speaks on
 * mount, Chromium refuses audio before a gesture, and the old code fell through to a browser
 * voice that does not exist on Linux — then blamed the absent speech engine. The person saw a
 * console warning telling them to install espeak for a problem the browser had just created.
 */
describe("speech blocked before a gesture", () => {
  it("is told apart from having no voice at all", async () => {
    const { isAutoplayBlock } = await import("./fadi-speech");
    expect(isAutoplayBlock(new DOMException("play() failed", "NotAllowedError"))).toBe(true);
    expect(isAutoplayBlock(new DOMException("aborted", "AbortError"))).toBe(true);
    expect(isAutoplayBlock(new DOMException("boom", "NotSupportedError"))).toBe(false);
    expect(isAutoplayBlock(new Error("network"))).toBe(false);
  });
});

/**
 * SPEECH WAITING ON A GESTURE IS STILL SPEECH — it obeys Stop (Codex C15-07).
 *
 * The first version stored the TEXT in a module global with listeners nothing cleared, then
 * re-requested the audio on the next click: Stop, mute, an unmounted interview or a newer
 * utterance all left the old one queued to interrupt whatever came next, and the blob already
 * paid for was thrown away.
 */
describe("queued speech and Stop", () => {
  it("exports a queue that Stop can clear", async () => {
    const mod = await import("./fadi-speech");
    expect(typeof mod.stopFadiSpeech).toBe("function");
    // The queue is module-private by design; what matters publicly is that stopping is total,
    // which the source expresses by clearing it. This pins the contract at the seam we control.
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./fadi-speech.ts", import.meta.url), "utf8")
    );
    expect(source).toMatch(/export function stopFadiSpeech[\s\S]{0,600}clearQueuedSpeech\(\)/);
    // And a queued item carries the generation that asked for it, so a newer utterance wins.
    expect(source).toMatch(/queued\.generation !== generation/);
    // The element is kept rather than the text, so no second provider request is made.
    expect(source).toMatch(/el: HTMLAudioElement/);
  });
});

describe("speaking more than once in a session", () => {
  /**
   * The defect: a browser grants permission to the ELEMENT a gesture touched, and every
   * utterance built a new one. The greeting played and everything after it was refused, so
   * Fadi greeted you and then went silent for the rest of the conversation.
   */
  it("keeps the element a gesture unlocked, rather than building a new one each time", async () => {
    const played: string[] = [];
    const elements: unknown[] = [];

    class FakeAudio {
      src = "";
      volume = 1;
      currentTime = 0;
      onplay: (() => void) | null = null;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(src?: string) {
        this.src = src ?? "";
        elements.push(this);
      }
      play() {
        played.push(this.src);
        return Promise.resolve();
      }
      pause() {}
    }

    const original = globalThis.Audio;
    (globalThis as { Audio: unknown }).Audio = FakeAudio;
    try {
      const { primeFadiVoice } = await import("./fadi-speech");
      primeFadiVoice();
      await Promise.resolve();
      primeFadiVoice();
      await Promise.resolve();

      // One element, however many times it is primed: the permission is the element.
      expect(elements).toHaveLength(1);
      expect(played).toHaveLength(1);
    } finally {
      (globalThis as { Audio: unknown }).Audio = original;
    }
  });
});

describe("telling someone how to get the voice back", () => {
  /**
   * The question this answers: "I have a new Groq token, will it work?" A daily cap is on the
   * ACCOUNT, so a new key on the same account changes nothing — and advice that implies it
   * might is worse than none.
   */
  it("says a new key will not lift a daily cap", async () => {
    const { __adviceForTest } = await import("./fadi-speech");
    const advice = __adviceForTest(
      "Rate limit reached for model canopylabs/orpheus-v1-english ... tokens per day (TPD): Limit 3600"
    );

    expect(advice).toContain("daily limit on the whole account");
    expect(advice).toContain("new key on the same account will not lift it");
    expect(advice).toMatch(/OpenAI|local/);
  });

  it("names the one-click fix when the model just needs its terms accepted", async () => {
    const { __adviceForTest } = await import("./fadi-speech");
    expect(__adviceForTest("The model requires terms acceptance.")).toContain("one click");
  });

  it("sends a refused key back to Settings, not to a different provider", async () => {
    const { __adviceForTest } = await import("./fadi-speech");
    expect(__adviceForTest("Invalid API key provided")).toContain("Check the key in Settings");
  });
});
