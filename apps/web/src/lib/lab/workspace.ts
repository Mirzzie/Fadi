import "server-only";

import { realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { isInsideWorkspace } from "./policy";

/**
 * RESOLVING A PATH INSIDE THE WORKSPACE, WITHOUT BEING TRICKED.
 *
 * String checks on paths are where filesystem confinement is usually lost. Three separate
 * things have to be handled, and missing any one of them opens the whole disk:
 *
 *   1. `..` — the obvious one, and the only one most implementations catch.
 *   2. An absolute path — "/etc/passwd" ignores the root entirely if it is passed to
 *      `join` rather than checked.
 *   3. SYMLINKS — the one people forget. A link inside the workspace pointing at /etc is
 *      a legal path by every string test and a total escape by every real one. The only
 *      honest check is on the path the OS would actually open, which means asking the OS.
 *
 * A file that does not exist yet cannot be resolved directly, so the deepest EXISTING
 * ancestor is resolved and the remainder appended — the ancestor is where a symlink could
 * be hiding, and the remainder is a name that does not exist and therefore cannot be one.
 */

export type Resolved =
  | { ok: true; path: string }
  | { ok: false; reason: string };

const UNSAFE_SEGMENT = /(^|\/)\.\.(\/|$)/;

export async function resolveInWorkspace(
  workspaceRoot: string | null,
  relativePath: string,
): Promise<Resolved> {
  // No workspace means no filesystem, not the whole filesystem.
  if (!workspaceRoot) {
    return {
      ok: false,
      reason: "No workspace is set, so Fadi has no filesystem access at all. Set one first.",
    };
  }

  const raw = (relativePath ?? "").trim();
  if (!raw) return { ok: false, reason: "No path given." };
  if (isAbsolute(raw)) {
    return { ok: false, reason: "Paths are relative to your workspace — an absolute path is refused." };
  }
  if (UNSAFE_SEGMENT.test(raw.replaceAll("\\", "/"))) {
    return { ok: false, reason: "That path tries to climb out of the workspace." };
  }
  // NUL truncates a path at the OS boundary; anything containing one is not a real name.
  if (raw.includes("\0")) return { ok: false, reason: "That isn't a valid path." };

  let root: string;
  try {
    root = await realpath(workspaceRoot);
  } catch {
    return { ok: false, reason: "Your workspace directory doesn't exist any more." };
  }

  const candidate = resolve(root, raw);

  // Belt and braces: the segment walk below assumes the candidate sits under the root,
  // which today is guaranteed by the `..` check above. Deriving it with `relative`
  // instead of slicing by length means removing that check would still refuse rather
  // than produce nonsense segments — a guard should not be the only thing standing
  // between a bad path and a disk.
  const rel = relative(root, candidate);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    return { ok: false, reason: "That path tries to climb out of the workspace." };
  }

  // Walk up to the deepest part that exists, resolve THAT, then re-append the rest.
  const segments = rel.split(sep).filter(Boolean);
  let existing = root;
  let remainder: string[] = [];
  for (let i = segments.length; i >= 0; i--) {
    const attempt = join(root, ...segments.slice(0, i));
    try {
      existing = await realpath(attempt);
      remainder = segments.slice(i);
      break;
    } catch {
      // Doesn't exist yet — keep walking up.
    }
  }

  const finalPath = remainder.length ? join(existing, ...remainder) : existing;

  if (!isInsideWorkspace(finalPath, root)) {
    // Reached only via a symlink or a resolution surprise. Named plainly, because a
    // confinement failure the user cannot see is one they cannot reason about.
    return {
      ok: false,
      reason: "That path resolves outside your workspace — Fadi won't touch it.",
    };
  }

  return { ok: true, path: finalPath };
}
