import { describe, expect, it } from "vitest";

import { describeLabDisk, formatBytes, IDLE_DAYS, type LabDiskInput } from "./disks";

const now = Date.UTC(2026, 8, 29);
const day = 86_400_000;
const lab = (over: Partial<LabDiskInput>): LabDiskInput => ({
  name: "project-abc",
  projectTitle: "AD forest",
  projectStatus: "active",
  running: false,
  container: true,
  lastActiveAt: new Date(now - 2 * day),
  bytes: 10.5 * 1024 ** 3,
  ...over,
});

describe("describeLabDisk", () => {
  it("never suggests removing a running lab, and says why it cannot go yet", () => {
    const view = describeLabDisk(lab({ running: true, projectStatus: "done" }), now);
    expect(view).toMatchObject({ suggestRemoval: null, blocked: "running", idleDays: null });
  });

  it("leaves a lab alone while its project is in progress and recently used", () => {
    expect(describeLabDisk(lab({}), now).suggestRemoval).toBeNull();
  });

  it("suggests removal for finished, dropped, orphaned and long-idle labs", () => {
    expect(describeLabDisk(lab({ projectStatus: "done" }), now).suggestRemoval).toBe("finished");
    expect(describeLabDisk(lab({ projectStatus: "abandoned" }), now).suggestRemoval).toBe(
      "dropped"
    );
    expect(
      describeLabDisk(lab({ projectTitle: null, projectStatus: null }), now).suggestRemoval
    ).toBe("orphaned");
    const idle = describeLabDisk(lab({ lastActiveAt: new Date(now - IDLE_DAYS * day) }), now);
    expect(idle).toMatchObject({ suggestRemoval: "idle", idleDays: IDLE_DAYS });
  });
});

describe("formatBytes", () => {
  it("reads the way people talk about disk", () => {
    expect(formatBytes(10.5 * 1024 ** 3)).toBe("10.5 GB");
    expect(formatBytes(812 * 1024 ** 2)).toBe("812 MB");
    expect(formatBytes(null)).toBe("—");
  });
});
