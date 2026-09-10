import { beforeEach, describe, expect, it, vi } from "vitest";

import collectorWorker, {
  pageCursor,
} from "../../../../../infrastructure/portfolio-collector/worker.js";

const state = vi.hoisted(() => ({
  theme: {} as Record<string, unknown>,
  updateSite: vi.fn(),
  record: vi.fn(),
}));

vi.mock("@/lib/database/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@careeros/database", () => ({
  createProductEventsRepository: () => ({
    maxCollectorId: async () => 0,
    maxPayloadNumber: async () => 0,
    record: state.record,
  }),
  createPortfolioRepository: () => ({
    getSiteForUser: async () => ({ theme: { ...state.theme } }),
    updateSite: state.updateSite,
  }),
}));

beforeEach(() => {
  state.theme = {};
  state.record.mockReset();
  state.updateSite.mockReset();
  state.updateSite.mockImplementation(async (_userId, _siteId, patch) => {
    state.theme = patch.theme;
  });
  vi.stubEnv("PORTFOLIO_COLLECTOR_URL", "https://collector.test");
  vi.stubEnv("PORTFOLIO_COLLECTOR_TOKEN", "test-token");
});

describe("collector stream cursors", () => {
  it("D05: event synchronization never advances the independent feedback cursor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ events: [], scanned: 1000 })),
    );
    const { syncCollectorEvents } = await import("./collector-sync");

    const result = await syncCollectorEvents({ userId: "u1", siteId: "s1", handle: "me" });

    expect(result).toEqual({ ok: true, imported: 0, skipped: 0, lastId: 1000 });
    expect(state.theme).toEqual({ collectorCursor: 1000 });
    expect(state.theme).not.toHaveProperty("feedbackCursor");
  });

  it("D06: acknowledges only the last row returned in a limited page", () => {
    expect(pageCursor(10, [{ id: 11 }, { id: 12 }])).toBe(12);
    expect(pageCursor(12, [])).toBe(12);
  });

  it("would fail if a table high-water mark replaced the page cursor", () => {
    const returned = Array.from({ length: 200 }, (_, index) => ({ id: index + 1 }));
    expect(pageCursor(0, returned)).toBe(200);
    expect(pageCursor(0, returned)).not.toBe(5000);
  });

  it.each([
    { path: "export", field: "events", limit: 1000 },
    { path: "export-feedback", field: "feedback", limit: 200 },
  ])("returns a page cursor from the actual $path endpoint", async ({ path, field, limit }) => {
    const page = Array.from({ length: limit }, (_, index) => ({ id: index + 1 }));
    const database = {
      prepare: vi.fn((sql: string) => ({
        bind: () => ({ all: async () => ({ results: page }) }),
        // This branch reproduces the old implementation. If the endpoint asks for
        // the table maximum, the assertion below receives 5000 and fails.
        all: async () => ({ results: sql.includes("max(id)") ? [{ max: 5000 }] : page }),
      })),
    };
    const request = new Request(`https://collector.test/${path}?after=0`, {
      headers: { authorization: "Bearer test-token" },
    });

    const response = await collectorWorker.fetch(request, {
      EXPORT_TOKEN: "test-token",
      DB: database,
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body[field]).toHaveLength(limit);
    expect(body.scanned).toBe(limit);
    expect(database.prepare).not.toHaveBeenCalledWith(expect.stringContaining("max(id)"));
  });
});
