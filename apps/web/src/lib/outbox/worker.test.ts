import { describe, expect, it } from "vitest";

import type { OutboxEvent } from "@careeros/database";

import { drainOutboxWith, type OutboxStore } from "./worker";

function event(id: string, topic: string, attempts = 1): OutboxEvent {
  return {
    id,
    userId: "u",
    topic,
    payload: {},
    dedupeKey: id,
    status: "pending",
    attempts,
    availableAt: new Date(),
    lockedUntil: null,
    lastError: null,
    processedAt: null,
    createdAt: new Date(),
  };
}

function store(batches: OutboxEvent[][]) {
  const log: string[] = [];
  const s: OutboxStore = {
    async claim() {
      return batches.shift() ?? [];
    },
    async complete(id) {
      log.push(`done:${id}`);
    },
    async fail(e, error) {
      log.push(`fail:${e.id}:${error}`);
    },
  };
  return { s, log };
}

describe("drainOutboxWith", () => {
  it("delivers each event through its topic's handler and marks it done", async () => {
    const seen: string[] = [];
    const { s, log } = store([[event("a", "t"), event("b", "t")]]);
    const result = await drainOutboxWith(s, { t: async (e) => void seen.push(e.id) });
    expect(seen).toEqual(["a", "b"]);
    expect(log).toEqual(["done:a", "done:b"]);
    expect(result).toEqual({ delivered: 2, failed: 0 });
  });

  it("records a failure for retry without stopping the rest of the batch", async () => {
    const { s, log } = store([[event("a", "t"), event("b", "t")]]);
    const result = await drainOutboxWith(s, {
      t: async (e) => {
        if (e.id === "a") throw new Error("provider down");
      },
    });
    expect(log).toEqual(["fail:a:provider down", "done:b"]);
    expect(result).toEqual({ delivered: 1, failed: 1 });
  });

  it("fails an event whose topic has no handler instead of dropping it", async () => {
    const { s, log } = store([[event("a", "unknown")]]);
    await drainOutboxWith(s, {});
    expect(log[0]).toMatch(/^fail:a:No handler/);
  });

  it("keeps claiming full batches, and stops at a short one", async () => {
    const { s } = store([[event("a", "t"), event("b", "t")], [event("c", "t")], [event("d", "t")]]);
    const result = await drainOutboxWith(s, { t: async () => {} }, { batch: 2 });
    expect(result.delivered).toBe(3); // "d" waits for the next drain
  });
});
