import { describe, expect, it } from "vitest";

import {
  baselineStateFor,
  CLEAN_SNAPSHOT,
  CLEAN_SNAPSHOT_RE,
  cleanSnapshotFor,
  projectSnapshot,
} from "./vmware-snapshot";

const A = "df3e6d83-fca4-4848-9782-0e3b04a87eda";
const B = "11111111-2222-4333-8444-555555555555";
// Shares A's first 8 hex ("df3e6d83") but is a different run — the old prefix form collided here.
const A_PREFIX_TWIN = "df3e6d83-0000-4000-8000-000000000000";

describe("each project's own clean start on a shared VM (Codex VM-safety review, 17 Oct 2026)", () => {
  it("names a snapshot from the whole run id, not a prefix", () => {
    expect(projectSnapshot(A)).toBe("Fadi clean start df3e6d83fca4484897820e3b04a87eda");
    expect(CLEAN_SNAPSHOT_RE.test(projectSnapshot(A))).toBe(true);
    expect(CLEAN_SNAPSHOT_RE.test("Before my experiment")).toBe(false);
  });

  it("gives two runs that share their first 32 bits DIFFERENT snapshots (no prefix collision)", () => {
    expect(projectSnapshot(A)).not.toBe(projectSnapshot(A_PREFIX_TWIN));
    expect(cleanSnapshotFor([projectSnapshot(A_PREFIX_TWIN)], A)).toBeNull();
  });

  it("resets a project only to its OWN start, never to another's", () => {
    const names = [projectSnapshot(A), projectSnapshot(B)];
    expect(cleanSnapshotFor(names, A)).toBe(projectSnapshot(A));
    expect(cleanSnapshotFor(names, B)).toBe(projectSnapshot(B));
  });

  it("NEVER falls back to the machine's shared clean start as a reset target", () => {
    // Reverting the whole VM to a global point would erase other projects' work.
    expect(cleanSnapshotFor([CLEAN_SNAPSHOT, projectSnapshot(B)], A)).toBeNull();
    expect(cleanSnapshotFor([projectSnapshot(B), "My own snapshot"], A)).toBeNull();
  });
});

describe("baselineStateFor: own | legacy_present | missing", () => {
  it("is 'own' only when the project's own snapshot exists", () => {
    expect(baselineStateFor([projectSnapshot(A)], A)).toBe("own");
  });

  it("is 'legacy_present' (informational, never a reset target) when only the shared one is present", () => {
    // Fadi neither reverts to it nor derives a baseline from it; the project must still save its own.
    expect(baselineStateFor([CLEAN_SNAPSHOT], A)).toBe("legacy_present");
    expect(baselineStateFor([CLEAN_SNAPSHOT, projectSnapshot(B)], A)).toBe("legacy_present");
  });

  it("is 'missing' when neither this project's own nor the shared one is present", () => {
    expect(baselineStateFor([projectSnapshot(B), "My own snapshot"], A)).toBe("missing");
    expect(baselineStateFor([], A)).toBe("missing");
  });
});
