import { mkdtemp, mkdir, symlink, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveInWorkspace } from "./workspace";

/**
 * CONFINEMENT, AGAINST A REAL FILESYSTEM.
 *
 * This is the test that has to use real directories. Symlink escape cannot be tested with
 * a mocked fs, because the whole point is that the string looks fine and the OS disagrees
 * — a mock would agree with the string, which is exactly the bug.
 */

let root: string;
let outside: string;

beforeAll(async () => {
  const base = await mkdtemp(join(tmpdir(), "fadi-ws-"));
  root = join(base, "workspace");
  outside = join(base, "outside");
  await mkdir(root, { recursive: true });
  await mkdir(join(root, "project"), { recursive: true });
  await mkdir(outside, { recursive: true });
  await writeFile(join(outside, "secret.txt"), "not yours");

  // The trap: a link that lives inside the workspace and points out of it.
  await symlink(outside, join(root, "escape"));
  // And one pointing at a real system path, the shape people actually get hit by.
  await symlink("/etc", join(root, "etc-link"));
});

afterAll(async () => {
  if (root) await rm(join(root, ".."), { recursive: true, force: true });
});

describe("paths inside the workspace", () => {
  it("allows a normal relative path", async () => {
    const res = await resolveInWorkspace(root, "project/run.sh");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.path.startsWith(root)).toBe(true);
  });

  it("allows a file that does not exist yet", async () => {
    // The common case: Fadi is about to CREATE this. Resolution must not require it to
    // already be there, or nothing could ever be written.
    const res = await resolveInWorkspace(root, "project/new/deeper/notes.md");
    expect(res.ok).toBe(true);
  });
});

describe("paths that must be refused", () => {
  it("refuses climbing out with ..", async () => {
    for (const p of ["../outside/secret.txt", "project/../../outside/secret.txt", ".."]) {
      const res = await resolveInWorkspace(root, p);
      expect(res.ok, p).toBe(false);
    }
  });

  it("refuses an absolute path outright", async () => {
    for (const p of ["/etc/passwd", "/", root + "/project"]) {
      const res = await resolveInWorkspace(root, p);
      expect(res.ok, p).toBe(false);
    }
  });

  it("THE SYMLINK ESCAPE: a link inside the workspace pointing out of it", async () => {
    // "escape/secret.txt" contains no "..", is not absolute, and starts with the root by
    // every string test. The OS would open a file outside the workspace.
    const res = await resolveInWorkspace(root, "escape/secret.txt");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/outside your workspace/i);
  });

  it("refuses a link to a real system directory", async () => {
    const res = await resolveInWorkspace(root, "etc-link/passwd");
    expect(res.ok).toBe(false);
  });

  it("refuses a NUL byte, which truncates the path at the OS boundary", async () => {
    const res = await resolveInWorkspace(root, "project/ok.txt\0.png");
    expect(res.ok).toBe(false);
  });

  it("refuses everything when no workspace is set", async () => {
    // Absent must mean NO filesystem, never the whole one.
    const res = await resolveInWorkspace(null, "project/run.sh");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/no filesystem access/i);
  });

  it("refuses when the workspace directory has been removed", async () => {
    const res = await resolveInWorkspace(join(root, "does-not-exist"), "x.txt");
    expect(res.ok).toBe(false);
  });
});
