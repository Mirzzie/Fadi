import "server-only";

import { execFile } from "node:child_process";
import { readFile, mkdir, access } from "node:fs/promises";
import { promisify } from "node:util";

import { labKeyPath, LAB_KEY_COMMENT } from "./templates";

const run = promisify(execFile);

/**
 * The key Fadi uses to run approved checks inside Windows labs.
 *
 * One key for this computer, kept outside the repository (~/.config/fadi/lab-ssh by default)
 * and created on first use. Only the PUBLIC half ever enters a lab, as the one authorised key of
 * its local administrator; the private half never leaves this machine. A lab is disposable and
 * bound to 127.0.0.1, so the key opens nothing beyond Fadi's own labs.
 */
export async function ensureLabKey(): Promise<{ keyPath: string; publicKey: string }> {
  const keyPath = labKeyPath();
  try {
    await access(keyPath);
  } catch {
    await mkdir(keyPath.slice(0, keyPath.lastIndexOf("/")), { recursive: true, mode: 0o700 });
    await run("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-C", LAB_KEY_COMMENT, "-f", keyPath], {
      timeout: 15_000,
    });
  }
  const publicKey = (await readFile(keyPath + ".pub", "utf8")).trim();
  return { keyPath, publicKey };
}
