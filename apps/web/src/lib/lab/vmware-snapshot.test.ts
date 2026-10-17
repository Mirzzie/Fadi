import { describe, expect, it } from "vitest";

import {
  CLEAN_SNAPSHOT,
  CLEAN_SNAPSHOT_RE,
  cleanSnapshotFor,
  projectSnapshot,
} from "./vmware-snapshot";

const A = "df3e6d83-fca4-4848-9782-0e3b04a87eda";
const B = "11111111-2222-4333-8444-555555555555";

describe("each project's own clean start on a shared VM (17 Oct 2026)", () => {
  it("names a snapshot for its project", () => {
    expect(projectSnapshot(A)).toBe("Fadi clean start df3e6d83");
    expect(CLEAN_SNAPSHOT_RE.test(projectSnapshot(A))).toBe(true);
    expect(CLEAN_SNAPSHOT_RE.test("Before my experiment")).toBe(false);
  });

  it("resets project B to B's start, never to A's", () => {
    const names = [projectSnapshot(A), projectSnapshot(B)];
    expect(cleanSnapshotFor(names, A)).toBe(projectSnapshot(A));
    expect(cleanSnapshotFor(names, B)).toBe(projectSnapshot(B));
  });

  it("falls back to the machine's older shared clean start, and to nothing", () => {
    expect(cleanSnapshotFor([CLEAN_SNAPSHOT, projectSnapshot(B)], A)).toBe(CLEAN_SNAPSHOT);
    expect(cleanSnapshotFor([projectSnapshot(B), "My own snapshot"], A)).toBeNull();
  });
});
