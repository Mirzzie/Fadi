import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  values: new Map<string, string>(),
  ttlWrites: [] as Array<{ key: string; ttl: number }>,
  upsert: vi.fn(),
  deactivate: vi.fn(),
  archiveStale: vi.fn(),
  discover: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/kv/store", () => ({
  getKv: () => ({
    get: async (key: string) => mocks.values.get(key) ?? null,
    set: async (key: string, value: string, ttl: number) => {
      mocks.values.set(key, value);
      mocks.ttlWrites.push({ key, ttl });
    },
    setNx: async (key: string, value: string) => {
      if (mocks.values.has(key)) return false;
      mocks.values.set(key, value);
      return true;
    },
    deleteIfValue: async (key: string, expected: string) => {
      if (mocks.values.get(key) !== expected) return false;
      mocks.values.delete(key);
      return true;
    },
    expireIfValue: async (key: string, expected: string) =>
      mocks.values.get(key) === expected,
    incr: vi.fn(),
  }),
}));
vi.mock("@/lib/data-sources/service", () => ({
  discoverJobs: mocks.discover,
}));
vi.mock("@careeros/database", () => ({
  createJobsRepository: () => ({
    upsertSeedJob: mocks.upsert,
    deactivateBySource: mocks.deactivate,
    archiveStaleLiveJobs: mocks.archiveStale,
  }),
}));

beforeEach(() => {
  mocks.values.clear();
  mocks.ttlWrites.length = 0;
  mocks.upsert.mockReset();
  mocks.deactivate.mockReset();
  mocks.archiveStale.mockReset();
  mocks.discover.mockReset();
  mocks.discover.mockResolvedValue([
    {
      sourceId: "board-a",
      externalId: "a-1",
      title: "Support Engineer",
      company: "Example",
      location: "Dublin",
      remote: false,
    },
    {
      sourceId: "board-b",
      externalId: "b-1",
      title: "Support Engineer",
      company: "Example Two",
      location: "Dublin",
      remote: false,
    },
  ]);
});

describe("job discovery commit outcome", () => {
  it("D13: preserves existing jobs and reports persistence failure when every upsert fails", async () => {
    mocks.upsert.mockRejectedValue(new Error("database unavailable"));
    const { ensureFreshLiveJobs } = await import("./sync");

    const found = await ensureFreshLiveJobs({
      targetRole: "Support Engineer",
      skills: [],
      skillGaps: [],
    });

    expect(found).toBe(0);
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.deactivate).not.toHaveBeenCalled();
    expect(mocks.archiveStale).not.toHaveBeenCalled();
    expect(mocks.ttlWrites.some((write) => write.ttl === 60)).toBe(true);

    const statusEntry = [...mocks.values.entries()].find(([key]) => key.startsWith("jobsync-status:"));
    expect(statusEntry).toBeDefined();
    const status = JSON.parse(statusEntry![1]);
    expect(status).toMatchObject({
      running: false,
      outcome: "persist_failed",
      found: 0,
      persistFailed: 2,
    });
  });

  it("D14: a missing in-flight lease turns orphaned running status into failure", async () => {
    let finish: ((rows: unknown[]) => void) | undefined;
    mocks.discover.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { getJobSyncStatus, startBackgroundSync } = await import("./sync");
    const profile = { targetRole: "Support Engineer", skills: [], skillGaps: [] };

    await startBackgroundSync(profile);
    const lockKey = [...mocks.values.keys()].find((key) => key.endsWith(":lock"));
    expect(lockKey).toBeDefined();
    mocks.values.delete(lockKey!); // simulate process death followed by lease expiry

    const status = await getJobSyncStatus(profile);

    expect(status).toMatchObject({ running: false, outcome: "failed" });
    finish?.([]);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
